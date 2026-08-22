-- =====================================================================
-- Regard+ — logique de points
--
-- Toute écriture de points passe par ces fonctions, appelées en RPC
-- depuis les routes serveur avec la clé service_role. Elles sont ici et
-- non dans TypeScript pour une raison précise : le client REST de
-- Supabase ne sait pas ouvrir de transaction multi-requêtes, alors que
-- le débit EXIGE que le verrou, la lecture du solde et l'insertion
-- tiennent dans une seule et même transaction. Le corps d'une fonction
-- plpgsql en est une.
-- =====================================================================

-- Solde dérivé du registre. Jamais de colonne `points_balance`.
create or replace function account_balance(p_account_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(sum(amount), 0)::integer
    from point_entries
   where account_id = p_account_id;
$$;

-- BARÈME AU POIDS, jamais au type d'objet.
-- Si « lentilles = 12 points » était le seul item à 12 points, le solde
-- révélerait à lui seul la catégorie de déchet et le découplage des deux
-- domaines deviendrait cosmétique.
create or replace function points_for_weight(p_grams integer)
returns integer
language sql
immutable
as $$
  select greatest(1, p_grams / 10)::integer;
$$;

-- Résolution d'un compte depuis le QR (jeton) ou le code à 6 chiffres
-- saisi en mode dégradé quand le scanner échoue.
create or replace function resolve_account(p_ref text)
returns uuid
language sql
stable
as $$
  select id from accounts
   where account_token::text = p_ref
      or short_code = upper(p_ref)
   limit 1;
$$;

-- ---------------------------------------------------------------------
-- DÉPÔT — crédit. Se fait au seul scan, sans code PIN.
-- ---------------------------------------------------------------------
create or replace function fn_deposit(
  p_account_ref     text,
  p_partner_id      uuid,
  p_weight_grams    integer,
  p_waste_category  text,
  p_idempotency_key text
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id    uuid;
  v_partner_class text;
  v_points        integer;
  v_rows          integer;
  v_credited      integer;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_weight_grams is null or p_weight_grams <= 0 or p_weight_grams > 10000 then
    raise exception 'INVALID_WEIGHT';
  end if;

  v_account_id := resolve_account(p_account_ref);
  if v_account_id is null then
    raise exception 'ACCOUNT_NOT_FOUND';
  end if;

  select class into v_partner_class from partners where id = p_partner_id;
  if v_partner_class is null then
    raise exception 'PARTNER_NOT_FOUND';
  end if;

  v_points := points_for_weight(p_weight_grams);

  -- Le rejeu d'une même clé ne crédite pas une seconde fois.
  insert into point_entries (account_id, amount, reason, eur_value, partner_class, idempotency_key)
  values (v_account_id, v_points, 'deposit', v_points * 0.01, v_partner_class, p_idempotency_key)
  on conflict (idempotency_key) do nothing;

  get diagnostics v_rows = row_count;

  -- L'événement de collecte n'est enregistré qu'à la première exécution,
  -- sinon un double-clic gonflerait le poids collecté du réseau.
  -- Écrit dans le domaine « collecte » : ni account_id, ni lien vers l'entrée
  -- de points ci-dessus.
  if v_rows = 1 then
    insert into collection_events (partner_id, waste_category, weight_grams)
    values (p_partner_id, p_waste_category, p_weight_grams);
  end if;

  select amount into v_credited
    from point_entries where idempotency_key = p_idempotency_key;

  return json_build_object(
    'status',    'ok',
    'credited',  v_credited,
    'balance',   account_balance(v_account_id),
    'replayed',  v_rows = 0
  );
end;
$$;

-- ---------------------------------------------------------------------
-- DÉPENSE — débit. Exige le code à 4 chiffres affiché sur le pass.
-- ---------------------------------------------------------------------
create or replace function fn_redeem(
  p_account_ref     text,
  p_pin             text,
  p_reward_id       uuid,
  p_idempotency_key text
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
  v_pin        char(4);
  v_cost       integer;
  v_class      text;
  v_existing   integer;
  v_balance    integer;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  v_account_id := resolve_account(p_account_ref);
  if v_account_id is null then
    raise exception 'ACCOUNT_NOT_FOUND';
  end if;

  select pin into v_pin from accounts where id = v_account_id;
  if p_pin is null or v_pin is distinct from p_pin then
    raise exception 'INVALID_PIN';
  end if;

  -- VERROU PAR COMPTE. Sérialise les débits concurrents du même compte :
  -- sans lui, deux requêtes simultanées lisent le même solde, le jugent
  -- suffisant toutes les deux, et le font passer en négatif. Il est tenu
  -- jusqu'à la fin de la transaction, donc jusqu'après l'insertion.
  perform pg_advisory_xact_lock(hashtext(v_account_id::text));

  select amount into v_existing
    from point_entries where idempotency_key = p_idempotency_key;
  if found then
    return json_build_object(
      'status', 'ok', 'debited', abs(v_existing),
      'balance', account_balance(v_account_id), 'replayed', true
    );
  end if;

  select r.cost_points, p.class into v_cost, v_class
    from rewards r join partners p on p.id = r.partner_id
   where r.id = p_reward_id;
  if v_cost is null then
    raise exception 'REWARD_NOT_FOUND';
  end if;

  -- Solde lu APRÈS le verrou et dans la MÊME transaction que l'insertion.
  v_balance := account_balance(v_account_id);
  if v_balance < v_cost then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  insert into point_entries (account_id, amount, reason, eur_value, partner_class, idempotency_key)
  values (v_account_id, -v_cost, 'redemption', -v_cost * 0.01, v_class, p_idempotency_key);

  return json_build_object(
    'status',   'ok',
    'debited',  v_cost,
    'balance',  account_balance(v_account_id),
    'replayed', false
  );
end;
$$;

-- Ces fonctions ne sont appelables que par le serveur (service_role).
revoke execute on function fn_deposit(text, uuid, integer, text, text) from public, anon, authenticated;
revoke execute on function fn_redeem(text, text, uuid, text)          from public, anon, authenticated;
grant  execute on function fn_deposit(text, uuid, integer, text, text) to service_role;
grant  execute on function fn_redeem(text, text, uuid, text)           to service_role;

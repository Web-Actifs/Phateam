-- =====================================================================
-- Inscription d'un porteur.
--
-- Email seul. Pas de mot de passe. Et AUCUNE question sur l'équipement
-- optique de la personne : ni type de lentilles, ni fréquence, ni
-- correction. Le compte ne sait rien de la vue de son titulaire.
--
-- Idempotente sur l'email : réutiliser la même adresse rouvre le même
-- pass au lieu d'échouer. Pendant une démonstration, on ressaisit
-- souvent la même adresse.
-- =====================================================================

create or replace function fn_signup(p_email text)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_email text := lower(trim(p_email));
  v_id    uuid;
  v_token uuid;
  v_pin   char(4);
  v_code  char(6);
begin
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'INVALID_EMAIL';
  end if;

  select id, account_token, pin, short_code
    into v_id, v_token, v_pin, v_code
    from accounts where email = v_email;

  if found then
    return json_build_object('token', v_token, 'pin', v_pin,
                             'shortCode', v_code, 'created', false);
  end if;

  -- Code à 6 chiffres unique : quelques tentatives suffisent très
  -- largement à cette échelle.
  for i in 1..40 loop
    v_code := lpad((300000 + floor(random() * 600000))::int::text, 6, '0');
    exit when not exists (select 1 from accounts where short_code = v_code);
    v_code := null;
  end loop;
  if v_code is null then
    raise exception 'SHORT_CODE_EXHAUSTED';
  end if;

  v_pin := lpad((floor(random() * 10000))::int::text, 4, '0');

  insert into accounts (email, pin, short_code)
  values (v_email, v_pin, v_code)
  returning account_token into v_token;

  return json_build_object('token', v_token, 'pin', v_pin,
                           'shortCode', v_code, 'created', true);
end;
$fn$;

revoke execute on function fn_signup(text) from public, anon, authenticated;
grant  execute on function fn_signup(text) to service_role;

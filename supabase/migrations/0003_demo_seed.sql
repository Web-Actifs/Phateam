-- =====================================================================
-- Jeu de démonstration — rejouable
--
-- Écrit comme une fonction et non comme un script Node pour que la route
-- POST /api/demo/reset puisse la rappeler telle quelle entre deux démos.
--
-- Les noms d'enseigne sont INVENTÉS. Aucune ne reprend, même de loin, une
-- enseigne d'optique existante. Les adresses, elles, sont réelles : la
-- densité lyonnaise fait partie du pitch.
-- =====================================================================

create or replace function fn_demo_reset()
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_partners uuid[];
  v_accounts uuid[];
  v_pid      uuid;
  v_acc      uuid;
  v_cats     text[] := array['blister','opercule','étui','flacon de solution'];
  m          int;
  i          int;
  n          int;
  v_when     timestamptz;
  v_grams    int;
  v_deposits int := 0;
begin
  -- Seul endroit du code où le registre est vidé : la remise à zéro d'une
  -- démonstration. En production cette fonction n'existerait pas.
  truncate collection_events, point_entries, rewards, accounts, partners
    restart identity cascade;

  -- --- 8 partenaires lyonnais -------------------------------------
  with ins as (
    insert into partners (name, address, city, lat, lng) values
      ('Optique Bellecour',      '12 rue de la République',        'Lyon', 45.764000, 4.835700),
      ('Lunetterie des Pentes',  '45 boulevard de la Croix-Rousse','Lyon', 45.777200, 4.832000),
      ('Regard Garibaldi',       '17 rue Garibaldi',               'Lyon', 45.760500, 4.852000),
      ('Atelier Guillotière',    '28 avenue Jean Jaurès',          'Lyon', 45.746000, 4.842000),
      ('Optique Saint-Jean',     '8 rue Saint-Jean',               'Lyon', 45.762500, 4.827000),
      ('Vision Confluence',      '112 cours Charlemagne',          'Lyon', 45.740500, 4.818000),
      ('Lumière Optique',        '65 avenue des Frères Lumière',   'Lyon', 45.744000, 4.870000),
      ('Le Comptoir de Vitton',  '34 cours Vitton',                'Lyon', 45.769000, 4.856000)
    returning id
  )
  select array_agg(id) into v_partners from ins;

  -- --- catalogue de récompenses -----------------------------------
  -- Seuils atteignables en 1 ou 2 dépôts (un dépôt courant = 10 à 20 points),
  -- jamais un palier lointain.
  foreach v_pid in array v_partners loop
    insert into rewards (partner_id, title, description, cost_points) values
      (v_pid, 'Produit d''entretien offert',  'Flacon de solution multifonction 100 ml',      15),
      (v_pid, 'Étui rigide',                  'Étui de transport, coloris au choix',          20),
      (v_pid, 'Don de 3 € à une association', 'Reversé à une association de santé visuelle',  25),
      (v_pid, '15 € sur une paire solaire',   'Valable sur la collection en boutique',        40);
  end loop;

  -- --- 3 comptes de démonstration nommés ---------------------------
  -- Documentés dans le README. Codes à 6 chiffres et PIN fixes.
  insert into accounts (email, pin, short_code) values
    ('nouveau@demo.phateam.fr', '1111', '100001'),
    ('actif@demo.phateam.fr',   '2222', '100002'),
    ('ancien@demo.phateam.fr',  '3333', '100003');

  -- --- 120 porteurs anonymes ---------------------------------------
  for i in 1..120 loop
    insert into accounts (email, pin, short_code)
    values (
      'porteur' || lpad(i::text, 3, '0') || '@demo.phateam.fr',
      lpad((floor(random() * 10000))::int::text, 4, '0'),
      lpad((200000 + i)::text, 6, '0')
    );
  end loop;

  select array_agg(id) into v_accounts
    from accounts where email like 'porteur%';

  -- --- historique sur 8 mois, en croissance -------------------------
  -- m = 0 le mois le plus ancien. La courbe monte de façon plausible
  -- plutôt qu'en ligne droite : c'est elle qu'on projette sur /impact.
  for m in 0..7 loop
    n := 10 + (m * m * 2);          -- 10, 12, 18, 28, 42, 60, 82, 108
    for i in 1..n loop
      v_acc   := v_accounts[1 + floor(random() * array_length(v_accounts, 1))::int];
      v_pid   := v_partners[1 + floor(random() * 8)::int];
      v_grams := 50 + floor(random() * 46)::int * 10;   -- 50 à 500 g
      -- Ancré sur les débuts de mois calendaires, et borné à maintenant :
      -- un dépôt daté du mois prochain se verrait immédiatement sur la
      -- courbe projetée.
      v_when  := least(
                   now() - interval '1 hour',
                   date_trunc('month', now())
                   - make_interval(months => 7 - m)
                   + make_interval(days  => floor(random() * 27)::int,
                                   hours => 9 + floor(random() * 9)::int)
                 );

      -- domaine « compte » : des points, une classe de partenaire, rien d'autre
      insert into point_entries (account_id, amount, reason, eur_value, partner_class,
                                 idempotency_key, created_at)
      values (v_acc, points_for_weight(v_grams), 'deposit',
              points_for_weight(v_grams) * 0.01, 'optician',
              'seed-' || gen_random_uuid()::text, v_when);

      -- domaine « collecte » : un poids, une catégorie, un partenaire.
      -- AUCUN lien avec la ligne ci-dessus. La catégorie est tirée
      -- indépendamment : elle ne se déduit ni du compte ni des points.
      insert into collection_events (partner_id, waste_category, weight_grams, occurred_at)
      values (v_pid, v_cats[1 + floor(random() * 4)::int], v_grams, v_when);

      v_deposits := v_deposits + 1;
    end loop;
  end loop;

  -- --- profils des 3 comptes de démonstration -----------------------
  -- « actif » : 22 points, soit 3 points sous le don à 25. Il faut qu'on
  -- puisse montrer « plus que 3 points » à l'écran pendant la démo.
  select id into v_acc from accounts where email = 'actif@demo.phateam.fr';
  insert into point_entries (account_id, amount, reason, eur_value, partner_class, idempotency_key, created_at)
  values (v_acc, 10, 'deposit', 0.10, 'optician', 'seed-actif-1', now() - interval '31 days'),
         (v_acc, 12, 'deposit', 0.12, 'optician', 'seed-actif-2', now() - interval '9 days');
  insert into collection_events (partner_id, waste_category, weight_grams, occurred_at)
  values (v_partners[1], 'blister', 100, now() - interval '31 days'),
         (v_partners[3], 'flacon de solution', 120, now() - interval '9 days');

  -- « ancien » : long historique, deux récompenses déjà dépensées.
  select id into v_acc from accounts where email = 'ancien@demo.phateam.fr';
  for i in 1..14 loop
    v_grams := 80 + (i * 17) % 300;
    v_when  := now() - make_interval(days => 230 - (i * 16));
    insert into point_entries (account_id, amount, reason, eur_value, partner_class, idempotency_key, created_at)
    values (v_acc, points_for_weight(v_grams), 'deposit', points_for_weight(v_grams) * 0.01,
            'optician', 'seed-ancien-' || i, v_when);
    insert into collection_events (partner_id, waste_category, weight_grams, occurred_at)
    values (v_partners[1 + (i % 8)], v_cats[1 + (i % 4)], v_grams, v_when);
  end loop;
  insert into point_entries (account_id, amount, reason, eur_value, partner_class, idempotency_key, created_at)
  values (v_acc, -15, 'redemption', -0.15, 'optician', 'seed-ancien-r1', now() - interval '120 days'),
         (v_acc, -20, 'redemption', -0.20, 'optician', 'seed-ancien-r2', now() - interval '40 days');

  -- « nouveau » : aucun dépôt. Il sert à montrer les états vides.

  return json_build_object(
    'partners',   array_length(v_partners, 1),
    'accounts',   (select count(*) from accounts),
    'deposits',   v_deposits,
    'collection', (select count(*) from collection_events),
    'entries',    (select count(*) from point_entries)
  );
end;
$fn$;

revoke execute on function fn_demo_reset() from public, anon, authenticated;
grant  execute on function fn_demo_reset() to service_role;

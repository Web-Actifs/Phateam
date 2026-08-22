-- =====================================================================
-- Agrégats de l'écran /impact.
--
-- Toutes ces mesures sortent du DOMAINE « COLLECTE » seul (poids,
-- catégories, partenaires, horodatages) plus deux dénombrements du
-- domaine « compte ». Aucune jointure entre les deux : les chiffres du
-- réseau n'ont jamais besoin de savoir qui a déposé quoi.
-- =====================================================================

create or replace function fn_impact_stats()
returns json
language sql
stable
security definer
set search_path = public
as $fn$
  select json_build_object(
    'partnersActive', (select count(distinct partner_id) from collection_events),
    'partnersTotal',  (select count(*) from partners),
    'deposits',       (select count(*) from collection_events),
    'grams',          (select coalesce(sum(weight_grams), 0) from collection_events),
    'members',        (select count(*) from accounts),

    -- Série mensuelle sur 8 mois, avec cumul : c'est la courbe du pitch.
    'monthly', (
      select coalesce(json_agg(row_to_json(t) order by t.month), '[]'::json)
        from (
          select to_char(date_trunc('month', occurred_at), 'YYYY-MM') as month,
                 count(*)::int                                        as deposits,
                 sum(weight_grams)::int                               as grams,
                 sum(sum(weight_grams)) over (
                   order by date_trunc('month', occurred_at)
                 )::int                                               as cumulative
            from collection_events
           where occurred_at > now() - interval '9 months'
           group by date_trunc('month', occurred_at)
        ) t
    ),

    -- Répartition du gisement. Mesure d'ampleur, pas d'identité :
    -- une seule teinte suffit à la représenter.
    'categories', (
      select coalesce(json_agg(row_to_json(c) order by c.grams desc), '[]'::json)
        from (
          select waste_category as category,
                 sum(weight_grams)::int as grams,
                 count(*)::int as deposits
            from collection_events
           group by waste_category
        ) c
    ),

    -- Classement des points de collecte, pour montrer la densité locale.
    'partners', (
      select coalesce(json_agg(row_to_json(p) order by p.grams desc), '[]'::json)
        from (
          select pa.name, pa.address,
                 coalesce(sum(ce.weight_grams), 0)::int as grams,
                 count(ce.id)::int as deposits
            from partners pa
            left join collection_events ce on ce.partner_id = pa.id
           group by pa.id, pa.name, pa.address
        ) p
    )
  );
$fn$;

grant execute on function fn_impact_stats() to service_role;

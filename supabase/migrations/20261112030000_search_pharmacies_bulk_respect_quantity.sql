-- Recherche OCR groupée : la disponibilité est calculée pour les quantités réellement demandées.
-- Les termes reconnus restent une recherche, jamais une validation d'ordonnance.
create or replace function public.search_pharmacies_bulk(
  p_terms text[],
  p_quantities integer[],
  p_lat double precision,
  p_lng double precision,
  p_rayon_km double precision default 20
)
returns table(
  pharmacie_id uuid,
  nom text,
  quartier text,
  adresse text,
  lat double precision,
  lng double precision,
  de_garde boolean,
  stock_updated_at timestamptz,
  distance_km double precision,
  total_prix integer,
  items jsonb,
  trouves integer,
  demandes integer
)
language sql
stable
set search_path to 'extensions', 'public'
as $function$
  with invalid as (
    select exists (
      select 1 from unnest(coalesce(p_quantities, '{}'::integer[])) as q(qte) where q.qte <= 0
    ) has_invalid
  ),
  termes as (
    select
      t.n,
      lower(unaccent(trim(t.terme))) q,
      coalesce(p_quantities[t.n], 1) qte
    from unnest(coalesce(p_terms, '{}'::text[])) with ordinality as t(terme, n)
    where length(trim(t.terme)) > 1
  ),
  nb as (
    select count(*)::int c from termes
  ),
  cand as (
    select
      t.n,
      s.pharmacie_id,
      pr.id produit_id,
      pr.nom,
      pr.dosage,
      s.prix,
      s.quantite,
      t.qte,
      row_number() over (
        partition by t.n, s.pharmacie_id
        order by similarity(pr.nom_norm, t.q) desc, s.prix, pr.id
      ) rk
    from termes t
    join public.produits pr
      on pr.nom_norm % t.q or pr.nom_norm ilike '%' || t.q || '%'
    join public.stocks s
      on s.produit_id = pr.id
     and s.quantite > 0
     and (s.date_peremption is null or s.date_peremption >= current_date)
    join public.pharmacies ph
      on ph.id = s.pharmacie_id
     and ph.actif is true
  ),
  best as (
    select * from cand where rk = 1
  ),
  besoins as (
    select pharmacie_id, produit_id, sum(qte)::int qte_demandee
    from best
    group by pharmacie_id, produit_id
  ),
  disponibles as (
    select
      b.pharmacie_id,
      b.produit_id,
      p.nom,
      p.dosage,
      s.prix,
      s.quantite,
      b.qte_demandee
    from besoins b
    join public.stocks s
      on s.pharmacie_id = b.pharmacie_id
     and s.produit_id = b.produit_id
     and s.quantite >= b.qte_demandee
     and (s.date_peremption is null or s.date_peremption >= current_date)
    join public.produits p on p.id = b.produit_id
  ),
  termes_disponibles as (
    select b.pharmacie_id, count(distinct b.n)::int trouves
    from best b
    join disponibles d
      on d.pharmacie_id = b.pharmacie_id
     and d.produit_id = b.produit_id
    group by b.pharmacie_id
  ),
  agg as (
    select
      d.pharmacie_id,
      sum(d.prix * d.qte_demandee)::int total,
      jsonb_agg(
        jsonb_build_object(
          'produit_id', d.produit_id,
          'nom', d.nom,
          'dosage', d.dosage,
          'prix', d.prix,
          'quantite', d.quantite,
          'quantite_demandee', d.qte_demandee
        ) order by d.nom, d.produit_id
      ) items
    from disponibles d
    group by d.pharmacie_id
  )
  select
    ph.id, ph.nom, ph.quartier, ph.adresse, ph.lat, ph.lng,
    ph.de_garde, ph.stock_updated_at, distance.km,
    a.total, a.items, td.trouves, nb.c
  from agg a
  join termes_disponibles td on td.pharmacie_id = a.pharmacie_id
  join public.pharmacies ph on ph.id = a.pharmacie_id and ph.actif is true
  cross join nb
  cross join invalid
  cross join lateral (
    select 6371 * 2 * asin(sqrt(
      power(sin(radians(ph.lat - p_lat) / 2), 2)
      + cos(radians(p_lat)) * cos(radians(ph.lat))
      * power(sin(radians(ph.lng - p_lng) / 2), 2)
    )) km
  ) distance
  where distance.km <= p_rayon_km
    and not invalid.has_invalid
  order by (td.trouves = nb.c) desc, distance.km;
$function$;

revoke all on function public.search_pharmacies_bulk(text[], integer[], double precision, double precision, double precision) from public;
grant execute on function public.search_pharmacies_bulk(text[], integer[], double precision, double precision, double precision) to anon, authenticated;

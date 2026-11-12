-- NAXA — Marketplace Pharmacie : toutes les recherches doivent utiliser le stock vendable.
-- Corrige le contournement des read models qui lisaient directement public.stocks.
begin;

create or replace function public.search_pharmacies(
  p_terms text[],
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
security definer
set search_path = ''
as $function$
with termes as (
  select row_number() over () n, lower(extensions.unaccent(trim(t))) q
  from unnest(coalesce(p_terms,'{}'::text[])) t
  where length(trim(t)) > 1
),
nb as (select count(*)::int c from termes),
cand as (
  select t.n,s.pharmacie_id,pr.id produit_id,pr.nom,pr.dosage,
    offre.prix,offre.quantite,
    row_number() over(
      partition by t.n,s.pharmacie_id
      order by extensions.similarity(pr.nom_norm,t.q) desc,offre.prix,pr.id
    ) rk
  from termes t
  join public.produits pr
    on pr.nom_norm OPERATOR(extensions.%) t.q
    or pr.nom_norm ilike '%'||t.q||'%'
  join public.stocks s on s.produit_id=pr.id
  join lateral public.marketplace_offre_stock_disponible(s.pharmacie_id,s.produit_id) offre
    on offre.quantite > 0
  join public.pharmacies ph on ph.id=s.pharmacie_id
    and ph.actif is true and ph.visible_recherche is true
    and ph.est_demo is false and ph.archivee_le is null
),
best as (select * from cand where rk=1),
agg as (
  select pharmacie_id,count(distinct n)::int trouves,sum(prix)::int total,
    jsonb_agg(jsonb_build_object(
      'produit_id',produit_id,'nom',nom,'dosage',dosage,
      'prix',prix,'quantite',quantite
    ) order by n) items
  from best group by pharmacie_id
)
select ph.id,ph.nom,ph.quartier,ph.adresse,ph.lat,ph.lng,ph.de_garde,
  ph.stock_updated_at,d.km,a.total,a.items,a.trouves,nb.c
from agg a
join public.pharmacies ph on ph.id=a.pharmacie_id
  and ph.actif is true and ph.visible_recherche is true
  and ph.est_demo is false and ph.archivee_le is null
cross join nb
cross join lateral (
  select 6371*2*asin(sqrt(
    power(sin(radians(ph.lat-p_lat)/2),2)
    +cos(radians(p_lat))*cos(radians(ph.lat))
      *power(sin(radians(ph.lng-p_lng)/2),2)
  )) km
) d
where p_lat between -90 and 90
  and p_lng between -180 and 180
  and d.km<=least(greatest(coalesce(p_rayon_km,20),1),100)
order by (a.trouves=nb.c) desc,d.km;
$function$;

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
security definer
set search_path = ''
as $function$
with invalid as (
  select exists(
    select 1 from unnest(coalesce(p_quantities,'{}'::integer[])) q(qte)
    where q.qte<=0
  ) has_invalid
),
termes as (
  select t.n,lower(extensions.unaccent(trim(t.terme))) q,
    coalesce(p_quantities[t.n],1) qte
  from unnest(coalesce(p_terms,'{}'::text[])) with ordinality t(terme,n)
  where length(trim(t.terme))>1
),
nb as (select count(*)::int c from termes),
cand as (
  select t.n,s.pharmacie_id,pr.id produit_id,pr.nom,pr.dosage,
    offre.prix,offre.quantite,t.qte,
    row_number() over(
      partition by t.n,s.pharmacie_id
      order by extensions.similarity(pr.nom_norm,t.q) desc,offre.prix,pr.id
    ) rk
  from termes t
  join public.produits pr
    on pr.nom_norm OPERATOR(extensions.%) t.q
    or pr.nom_norm ilike '%'||t.q||'%'
  join public.stocks s on s.produit_id=pr.id
  join lateral public.marketplace_offre_stock_disponible(s.pharmacie_id,s.produit_id) offre
    on offre.quantite > 0
  join public.pharmacies ph on ph.id=s.pharmacie_id
    and ph.actif is true and ph.visible_recherche is true
    and ph.est_demo is false and ph.archivee_le is null
),
best as (select * from cand where rk=1),
besoins as (
  select pharmacie_id,produit_id,sum(qte)::int qte_demandee
  from best group by pharmacie_id,produit_id
),
disponibles as (
  select b.pharmacie_id,b.produit_id,p.nom,p.dosage,
    offre.prix,offre.quantite,b.qte_demandee
  from besoins b
  join lateral public.marketplace_offre_stock_disponible(b.pharmacie_id,b.produit_id) offre
    on offre.quantite >= b.qte_demandee
  join public.produits p on p.id=b.produit_id
),
termes_disponibles as (
  select b.pharmacie_id,count(distinct b.n)::int trouves
  from best b
  join disponibles d on d.pharmacie_id=b.pharmacie_id and d.produit_id=b.produit_id
  group by b.pharmacie_id
),
agg as (
  select d.pharmacie_id,sum(d.prix*d.qte_demandee)::int total,
    jsonb_agg(jsonb_build_object(
      'produit_id',d.produit_id,'nom',d.nom,'dosage',d.dosage,
      'prix',d.prix,'quantite',d.quantite,
      'quantite_demandee',d.qte_demandee
    ) order by d.nom,d.produit_id) items
  from disponibles d group by d.pharmacie_id
)
select ph.id,ph.nom,ph.quartier,ph.adresse,ph.lat,ph.lng,ph.de_garde,
  ph.stock_updated_at,distance.km,a.total,a.items,td.trouves,nb.c
from agg a
join termes_disponibles td on td.pharmacie_id=a.pharmacie_id
join public.pharmacies ph on ph.id=a.pharmacie_id
  and ph.actif is true and ph.visible_recherche is true
  and ph.est_demo is false and ph.archivee_le is null
cross join nb
cross join invalid
cross join lateral (
  select 6371*2*asin(sqrt(
    power(sin(radians(ph.lat-p_lat)/2),2)
    +cos(radians(p_lat))*cos(radians(ph.lat))
      *power(sin(radians(ph.lng-p_lng)/2),2)
  )) km
) distance
where p_lat between -90 and 90
  and p_lng between -180 and 180
  and distance.km<=least(greatest(coalesce(p_rayon_km,20),1),100)
  and not invalid.has_invalid
order by (td.trouves=nb.c) desc,distance.km;
$function$;

commit;

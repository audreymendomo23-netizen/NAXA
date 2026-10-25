-- Garde-fous SQL pour empêcher les fiches non validées et les stocks de
-- pharmacies masquées d'alimenter le panier et les produits populaires.
-- Migration additive : aucune suppression de données.
begin;

create or replace function public.search_pharmacies_panier(
  p_items jsonb,
  p_lat float8,
  p_lng float8,
  p_rayon_km float8 default 20
)
returns table(
  pharmacie_id uuid, nom text, quartier text, adresse text, lat float8, lng float8,
  de_garde boolean, stock_updated_at timestamptz, distance_km float8,
  total_prix int, items jsonb, trouves int, demandes int
)
language sql stable security definer set search_path=public,extensions as $$
with req as (
  select (x->>'produit_id')::uuid produit_id,
         greatest(1,least(10,coalesce((x->>'quantite')::int,1))) qte
  from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) x
), nb as (select count(*)::int c from req),
ok as (
  select s.pharmacie_id,s.produit_id,p.nom,p.dosage,s.prix,s.quantite,r.qte
  from req r
  join stocks s on s.produit_id=r.produit_id and s.quantite>=r.qte and s.prix>=0
  join produits p on p.id=s.produit_id and p.fiche_validee=true
), agg as (
  select pharmacie_id,count(*)::int trouves,
         sum(prix*qte)::int total,
         jsonb_agg(jsonb_build_object(
           'produit_id',produit_id,'nom',nom,'dosage',dosage,
           'prix',prix,'quantite',quantite,'quantite_demandee',qte
         ) order by nom) items
  from ok group by pharmacie_id
)
select ph.id,ph.nom,ph.quartier,ph.adresse,ph.lat,ph.lng,ph.de_garde,
       ph.stock_updated_at,d.km,a.total,a.items,a.trouves,nb.c
from agg a
join pharmacies ph on ph.id=a.pharmacie_id
  and ph.actif=true and ph.visible_recherche=true and ph.archivee_le is null
  and coalesce(ph.est_demo,false)=false
cross join nb
cross join lateral (
  select 6371*2*asin(sqrt(
    power(sin(radians(ph.lat-p_lat)/2),2)
    + cos(radians(p_lat))*cos(radians(ph.lat))
    * power(sin(radians(ph.lng-p_lng)/2),2)
  )) km
) d
where d.km<=p_rayon_km
order by (a.trouves=nb.c) desc,d.km;
$$;

create or replace function public.produits_populaires(p_limit int default 10,p_jours int default 7)
returns table(produit_id uuid,nom text,dosage text,photo_url text,prix_min int)
language sql stable security definer set search_path=public as $$
with top as (
  select p.id,p.nom,p.dosage,p.photo_url,min(s.prix)::int prix_min,count(e.id)::int score
  from recherche_events e
  join produits p on p.id=e.produit_id and p.fiche_validee=true
  join stocks s on s.produit_id=p.id and s.quantite>0 and s.prix>=0
  join pharmacies ph on ph.id=s.pharmacie_id and ph.actif=true
    and ph.visible_recherche=true and ph.archivee_le is null
    and coalesce(ph.est_demo,false)=false
  where e.created_at>now()-make_interval(days=>greatest(0,p_jours))
  group by p.id
), comp as (
  select p.id,p.nom,p.dosage,p.photo_url,min(s.prix)::int prix_min,
         count(distinct s.pharmacie_id)::int score
  from produits p
  join stocks s on s.produit_id=p.id and s.quantite>0 and s.prix>=0
  join pharmacies ph on ph.id=s.pharmacie_id and ph.actif=true
    and ph.visible_recherche=true and ph.archivee_le is null
    and coalesce(ph.est_demo,false)=false
  where p.fiche_validee=true and not exists(select 1 from top t where t.id=p.id)
  group by p.id
)
select id,nom,dosage,photo_url,prix_min
from (select *,1 rang from top union all select *,2 rang from comp) x
order by rang,score desc
limit least(greatest(coalesce(p_limit,10),1),20);
$$;

grant execute on function public.search_pharmacies_panier(jsonb,float8,float8,float8) to anon,authenticated;
grant execute on function public.produits_populaires(int,int) to anon,authenticated;

commit;

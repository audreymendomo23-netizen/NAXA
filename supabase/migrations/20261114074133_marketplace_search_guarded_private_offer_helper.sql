-- NAXA — isoler le helper Marketplace historique et garder le wrapper public invoker.
begin;
CREATE OR REPLACE FUNCTION private.marketplace_offre_stock_disponible_guarded(p_pharmacie uuid, p_produit uuid)
 RETURNS TABLE(prix integer, quantite integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_stock public.stocks%rowtype;
  v_has_lots boolean;
  v_disponible integer;
  v_reserve integer;
  v_last_stock_update timestamptz;
begin
  if p_pharmacie is null or p_produit is null then
    return;
  end if;

  -- Le catalogue Marketplace ne publie jamais une fiche non validée.
  if not exists (
    select 1 from public.produits p
    where p.id=p_produit and p.fiche_validee is true
  ) then
    return;
  end if;

  select s.*
    into v_stock
  from public.stocks s
  join public.pharmacies ph on ph.id=s.pharmacie_id
  where s.pharmacie_id=p_pharmacie
    and s.produit_id=p_produit
    and ph.actif is true
    and ph.visible_recherche is true
    and ph.est_demo is false
    and ph.archivee_le is null;

  if not found then
    return;
  end if;

  v_last_stock_update := private.marketplace_stock_last_quantity_update(p_pharmacie,p_produit);
  if v_last_stock_update is null
     or v_last_stock_update < now()-interval '48 hours' then
    return;
  end if;

  select exists (
    select 1 from public.stocks_lots l
    where l.pharmacie_id=p_pharmacie and l.produit_id=p_produit
  ) into v_has_lots;

  if v_has_lots then
    select coalesce(sum(l.quantite),0)::integer
      into v_disponible
    from public.stocks_lots l
    where l.pharmacie_id=p_pharmacie
      and l.produit_id=p_produit
      and coalesce(l.bloque,false)=false
      and (l.date_peremption is null or l.date_peremption>=current_date);
  else
    v_disponible := case
      when v_stock.date_peremption is null or v_stock.date_peremption>=current_date
        then greatest(coalesce(v_stock.quantite,0),0)
      else 0
    end;
  end if;

  select coalesce(sum(ri.quantite),0)::integer
    into v_reserve
  from public.reservation_items ri
  join public.reservations r on r.id=ri.reservation_id
  where r.pharmacie_id=p_pharmacie
    and ri.produit_id=p_produit
    and r.mode in ('reservation','commande')
    and r.statut in ('en_attente','confirmee')
    and r.expires_at>now()
    and r.consumed_at is null
    and coalesce(r.stock_restored,false)=false
    and coalesce(r.stock_decremented,false)=false;

  return query
    select v_stock.prix,greatest(coalesce(v_disponible,0)-coalesce(v_reserve,0),0);
end;
$function$
;
CREATE OR REPLACE FUNCTION private.search_pharmacies(p_terms text[], p_lat double precision, p_lng double precision, p_rayon_km double precision DEFAULT 20)
 RETURNS TABLE(pharmacie_id uuid, nom text, quartier text, adresse text, lat double precision, lng double precision, de_garde boolean, stock_updated_at timestamp with time zone, distance_km double precision, total_prix integer, items jsonb, trouves integer, demandes integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with input_valid as (
  select
    coalesce(cardinality(p_terms),0) between 1 and 20
    and p_lat between -90 and 90
    and p_lng between -180 and 180
    and not exists (
      select 1 from unnest(coalesce(p_terms,'{}'::text[])) t
      where t is null or length(trim(t))<2 or length(trim(t))>120
    ) as ok
),
termes as (
  select row_number() over () n,lower(extensions.unaccent(trim(t))) q
  from unnest(coalesce(p_terms,'{}'::text[])) t
  where length(trim(t)) between 2 and 120
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
  cross join input_valid iv
  join public.produits pr
    on pr.fiche_validee is true
    and (pr.nom_norm operator(extensions.%) t.q or pr.nom_norm ilike '%'||t.q||'%')
  join public.stocks s on s.produit_id=pr.id
  join lateral private.marketplace_offre_stock_disponible_guarded(s.pharmacie_id,s.produit_id) offre
    on offre.quantite>0
  join public.pharmacies ph on ph.id=s.pharmacie_id
    and ph.actif is true and ph.visible_recherche is true
    and ph.est_demo is false and ph.archivee_le is null
  where iv.ok
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
cross join input_valid iv
cross join lateral (
  select 6371*2*asin(sqrt(
    power(sin(radians(ph.lat-p_lat)/2),2)
    +cos(radians(p_lat))*cos(radians(ph.lat))
      *power(sin(radians(ph.lng-p_lng)/2),2)
  )) km
) d
where iv.ok
  and d.km<=least(greatest(coalesce(p_rayon_km,20),1),100)
order by (a.trouves=nb.c) desc,d.km;
$function$
;
CREATE OR REPLACE FUNCTION private.search_pharmacies_bulk(p_terms text[], p_quantities integer[], p_lat double precision, p_lng double precision, p_rayon_km double precision DEFAULT 20)
 RETURNS TABLE(pharmacie_id uuid, nom text, quartier text, adresse text, lat double precision, lng double precision, de_garde boolean, stock_updated_at timestamp with time zone, distance_km double precision, total_prix integer, items jsonb, trouves integer, demandes integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with invalid as (
  select not (
    coalesce(cardinality(p_terms),0) between 1 and 20
    and coalesce(cardinality(p_quantities),0)=coalesce(cardinality(p_terms),0)
    and p_lat between -90 and 90
    and p_lng between -180 and 180
    and not exists (
      select 1 from unnest(coalesce(p_terms,'{}'::text[])) t
      where t is null or length(trim(t))<2 or length(trim(t))>120
    )
    and not exists (
      select 1 from unnest(coalesce(p_quantities,'{}'::integer[])) q
      where q is null or q<1 or q>10
    )
  ) has_invalid
),
termes as (
  select t.n,lower(extensions.unaccent(trim(t.terme))) q,p_quantities[t.n] qte
  from unnest(coalesce(p_terms,'{}'::text[])) with ordinality t(terme,n)
  where length(trim(t.terme)) between 2 and 120
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
    on pr.fiche_validee is true
    and (pr.nom_norm operator(extensions.%) t.q or pr.nom_norm ilike '%'||t.q||'%')
  join public.stocks s on s.produit_id=pr.id
  join lateral private.marketplace_offre_stock_disponible_guarded(s.pharmacie_id,s.produit_id) offre
    on offre.quantite>0
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
  join lateral private.marketplace_offre_stock_disponible_guarded(b.pharmacie_id,b.produit_id) offre
    on offre.quantite>=b.qte_demandee
  join public.produits p on p.id=b.produit_id and p.fiche_validee is true
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
$function$
;
CREATE OR REPLACE FUNCTION public.marketplace_offre_stock_disponible(p_pharmacie uuid, p_produit uuid)
 RETURNS TABLE(prix integer, quantite integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select * from private.marketplace_offre_stock_disponible_guarded(p_pharmacie,p_produit);
$function$
;
revoke all on function private.marketplace_offre_stock_disponible(uuid,uuid) from public,anon,authenticated;
revoke all on function private.marketplace_offre_stock_disponible_guarded(uuid,uuid) from public;
grant execute on function private.marketplace_offre_stock_disponible_guarded(uuid,uuid) to anon,authenticated;
grant execute on function private.search_pharmacies(text[],double precision,double precision,double precision) to anon,authenticated;
grant execute on function private.search_pharmacies_bulk(text[],integer[],double precision,double precision,double precision) to anon,authenticated;
commit;

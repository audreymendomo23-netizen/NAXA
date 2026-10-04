-- NAXA catalogue, fiches, dictionnaire, panier et produits populaires
alter table produits add column if not exists photo_url text;
alter table produits add column if not exists description text;
alter table produits add column if not exists indications text;
alter table produits add column if not exists precautions text;
alter table produits add column if not exists synonymes text[] not null default '{}';
alter table produits add column if not exists source_fiche text not null default 'aucune';
alter table produits add column if not exists fiche_validee boolean not null default false;
alter table produits add column if not exists fiche_maj timestamptz;

create table if not exists dictionnaire(
  terme text primary key,
  definition text not null
);
alter table dictionnaire enable row level security;
create policy if not exists dictionnaire_read on dictionnaire for select using(true);
create policy if not exists dictionnaire_write on dictionnaire for all using(is_admin()) with check(is_admin());

create or replace function search_pharmacies_panier(p_items jsonb,p_lat float8,p_lng float8,p_rayon_km float8 default 20)
returns table(pharmacie_id uuid,nom text,quartier text,adresse text,lat float8,lng float8,de_garde boolean,stock_updated_at timestamptz,distance_km float8,total_prix int,items jsonb,trouves int,demandes int)
language sql stable security definer set search_path=public,extensions as $$
with req as (
 select (x->>'produit_id')::uuid produit_id, greatest(1,least(10,coalesce((x->>'quantite')::int,1))) qte
 from jsonb_array_elements(p_items) x
),nb as(select count(*)::int c from req),
ok as (
 select s.pharmacie_id,s.produit_id,p.nom,p.dosage,s.prix,s.quantite,r.qte
 from req r join stocks s on s.produit_id=r.produit_id and s.quantite>=r.qte
 join produits p on p.id=s.produit_id
),agg as(
 select pharmacie_id,count(*)::int trouves,sum(prix*qte)::int total,
 jsonb_agg(jsonb_build_object('produit_id',produit_id,'nom',nom,'dosage',dosage,'prix',prix,'quantite',quantite,'quantite_demandee',qte) order by nom) items
 from ok group by pharmacie_id
)
select ph.id,ph.nom,ph.quartier,ph.adresse,ph.lat,ph.lng,ph.de_garde,ph.stock_updated_at,d.km,a.total,a.items,a.trouves,nb.c
from agg a join pharmacies ph on ph.id=a.pharmacie_id and ph.actif cross join nb
cross join lateral(select 6371*2*asin(sqrt(power(sin(radians(ph.lat-p_lat)/2),2)+cos(radians(p_lat))*cos(radians(ph.lat))*power(sin(radians(ph.lng-p_lng)/2),2))) km)d
where d.km<=p_rayon_km order by(a.trouves=nb.c)desc,d.km;
$$;

create table if not exists recherche_events(
 id bigserial primary key,
 produit_id uuid not null references produits(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index if not exists recherche_events_recent on recherche_events(created_at desc,produit_id);
alter table recherche_events enable row level security;

create or replace function log_recherche(p_terms text[]) returns void
language plpgsql security definer set search_path=public,extensions as $$
declare t text;pid uuid;
begin
 foreach t in array coalesce(p_terms,'{}') loop
   t:=lower(unaccent(trim(t)));
   if length(t)<3 or length(t)>80 then continue; end if;
   select id into pid from produits where nom_norm % t or nom_norm ilike '%'||t||'%' order by similarity(nom_norm,t) desc limit 1;
   if pid is not null then insert into recherche_events(produit_id)values(pid);end if;
 end loop;
end$$;

create or replace function produits_populaires(p_limit int default 10,p_jours int default 7)
returns table(produit_id uuid,nom text,dosage text,photo_url text,prix_min int)
language sql stable security definer set search_path=public as $$
with top as(
 select p.id,p.nom,p.dosage,p.photo_url,min(s.prix)::int prix_min,count(e.id)::int score
 from recherche_events e join produits p on p.id=e.produit_id join stocks s on s.produit_id=p.id and s.quantite>0
 where e.created_at>now()-make_interval(days=>p_jours) group by p.id
),comp as(
 select p.id,p.nom,p.dosage,p.photo_url,min(s.prix)::int prix_min,count(distinct s.pharmacie_id)::int score
 from produits p join stocks s on s.produit_id=p.id and s.quantite>0 where not exists(select 1 from top t where t.id=p.id) group by p.id
)
select id,nom,dosage,photo_url,prix_min from(select *,1 rang from top union all select *,2 rang from comp)x order by rang,score desc limit least(p_limit,20);
$$;
grant execute on function search_pharmacies_panier(jsonb,float8,float8,float8) to anon,authenticated;
grant execute on function log_recherche(text[]) to anon,authenticated;
grant execute on function produits_populaires(int,int) to anon,authenticated;

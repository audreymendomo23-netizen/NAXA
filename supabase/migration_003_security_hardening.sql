-- NAXA Phase 1 security/performance hardening
-- Apply after schema.sql and migration_002_catalogue_panier.sql.

create index if not exists profiles_pharmacie_id_idx on public.profiles(pharmacie_id);
create index if not exists recherche_events_produit_id_idx on public.recherche_events(produit_id);
create index if not exists reservation_items_produit_id_idx on public.reservation_items(produit_id);
create index if not exists reservations_client_id_idx on public.reservations(client_id);
create index if not exists reservations_pharmacie_id_idx on public.reservations(pharmacie_id);
create index if not exists stocks_produit_id_idx on public.stocks(produit_id);

create or replace function public.produits_norm() returns trigger
language plpgsql set search_path=public,extensions
as $$
begin
  new.nom_norm:=lower(unaccent(coalesce(new.nom,'')||' '||coalesce(new.dci,'')||' '||coalesce(new.dosage,'')));
  return new;
end
$$;

create or replace function public.search_pharmacies(p_terms text[],p_lat float8,p_lng float8,p_rayon_km float8 default 20)
returns table(pharmacie_id uuid,nom text,quartier text,adresse text,lat float8,lng float8,de_garde boolean,stock_updated_at timestamptz,distance_km float8,total_prix int,items jsonb,trouves int,demandes int)
language sql stable set search_path=public,extensions
as $$
with termes as(select row_number() over() n,lower(unaccent(trim(t))) q from unnest(p_terms)t where length(trim(t))>1),
nb as(select count(*)::int c from termes),
cand as(select t.n,s.pharmacie_id,pr.id produit_id,pr.nom,pr.dosage,s.prix,s.quantite,row_number() over(partition by t.n,s.pharmacie_id order by similarity(pr.nom_norm,t.q) desc,s.prix) rk from termes t join produits pr on pr.nom_norm % t.q or pr.nom_norm ilike '%'||t.q||'%' join stocks s on s.produit_id=pr.id and s.quantite>0),
best as(select * from cand where rk=1),
agg as(select pharmacie_id,count(distinct n)::int trouves,sum(prix)::int total,jsonb_agg(jsonb_build_object('produit_id',produit_id,'nom',nom,'dosage',dosage,'prix',prix,'quantite',quantite) order by n) items from best group by pharmacie_id)
select ph.id,ph.nom,ph.quartier,ph.adresse,ph.lat,ph.lng,ph.de_garde,ph.stock_updated_at,d.km,a.total,a.items,a.trouves,nb.c from agg a join pharmacies ph on ph.id=a.pharmacie_id and ph.actif cross join nb cross join lateral(select 6371*2*asin(sqrt(power(sin(radians(ph.lat-p_lat)/2),2)+cos(radians(p_lat))*cos(radians(ph.lat))*power(sin(radians(ph.lng-p_lng)/2),2))) km)d where d.km<=p_rayon_km order by(a.trouves=nb.c)desc,d.km
$$;

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select using((select auth.uid())=id or (select is_admin()));
drop policy if exists profiles_admin on public.profiles;
create policy profiles_admin on public.profiles for all using((select is_admin())) with check((select is_admin()));
drop policy if exists pharmacies_admin on public.pharmacies;
create policy pharmacies_admin on public.pharmacies for all using((select is_admin())) with check((select is_admin()));
drop policy if exists produits_write on public.produits;
create policy produits_write on public.produits for insert with check((select is_admin()) or (select my_pharmacie()) is not null);
drop policy if exists produits_update on public.produits;
create policy produits_update on public.produits for update using((select is_admin())) with check((select is_admin()));
drop policy if exists stocks_write on public.stocks;
create policy stocks_write on public.stocks for all using(pharmacie_id=(select my_pharmacie()) or (select is_admin())) with check(pharmacie_id=(select my_pharmacie()) or (select is_admin()));
drop policy if exists resa_read on public.reservations;
create policy resa_read on public.reservations for select using(client_id=(select auth.uid()) or pharmacie_id=(select my_pharmacie()) or (select is_admin()));
drop policy if exists resa_items_read on public.reservation_items;
create policy resa_items_read on public.reservation_items for select using(exists(select 1 from reservations r where r.id=reservation_id and(r.client_id=(select auth.uid()) or r.pharmacie_id=(select my_pharmacie()) or (select is_admin()))));

revoke all on table public.pharmacie_privee from anon,authenticated;
revoke all on table public.recherche_events from anon,authenticated;

revoke execute on function public.declare_payment(uuid,text) from anon,public;
grant execute on function public.declare_payment(uuid,text) to authenticated;
revoke execute on function public.reserve_stock(uuid,jsonb) from anon,public;
grant execute on function public.reserve_stock(uuid,jsonb) to authenticated;
revoke execute on function public.set_garde(boolean) from anon,public;
grant execute on function public.set_garde(boolean) to authenticated;
revoke execute on function public.set_reservation_status(uuid,resa_statut) from anon,public;
grant execute on function public.set_reservation_status(uuid,resa_statut) to authenticated;
revoke execute on function public.stocks_touch() from anon,authenticated,public;
revoke execute on function public.handle_new_user() from anon,authenticated,public;

revoke execute on function public.restore_stock(uuid) from public,anon,authenticated;
revoke execute on function public.expire_reservations() from public,anon,authenticated;

-- NAXA 099 — catalogue multi-univers et réservations avec retrait.
-- Dépend de migration_098_universes_partners_flags_audit_stock_movements.sql.
-- Additif : n’altère ni le catalogue ni les réservations historiques des pharmacies.
begin;

create table if not exists public.partner_products (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  universe_slug text not null references public.universes(slug) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 180),
  brand text,
  category text not null default 'Autres',
  description text,
  photo_url text,
  price_fcfa integer not null check (price_fcfa >= 0),
  stock_quantity numeric(12,3) not null default 0 check (stock_quantity >= 0),
  unit_label text not null default 'unité',
  expires_at date,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (universe_slug in ('parapharmacie','bebe-maman'))
);
create index if not exists partner_products_public_catalog_idx
  on public.partner_products(universe_slug,partner_id,status,category,name);
create index if not exists partner_products_partner_idx
  on public.partner_products(partner_id,updated_at desc);

create table if not exists public.universe_reservations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete restrict,
  partner_id uuid not null references public.partners(id) on delete restrict,
  universe_slug text not null references public.universes(slug) on delete restrict,
  status text not null default 'requested'
    check (status in ('requested','confirmed','ready','picked_up','cancelled','expired')),
  total_fcfa integer not null default 0 check (total_fcfa >= 0),
  pickup_code text not null unique default upper(substr(encode(gen_random_bytes(8),'hex'),1,8)),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  client_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  picked_up_at timestamptz
);
create index if not exists universe_reservations_client_idx
  on public.universe_reservations(client_id,created_at desc);
create index if not exists universe_reservations_partner_idx
  on public.universe_reservations(partner_id,status,created_at desc);

create table if not exists public.universe_reservation_items (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.universe_reservations(id) on delete restrict,
  product_id uuid not null references public.partner_products(id) on delete restrict,
  product_name text not null,
  unit_price_fcfa integer not null check (unit_price_fcfa >= 0),
  quantity integer not null check (quantity between 1 and 10),
  line_total_fcfa integer not null check (line_total_fcfa >= 0),
  created_at timestamptz not null default now(),
  unique(reservation_id,product_id)
);
create index if not exists universe_reservation_items_reservation_idx
  on public.universe_reservation_items(reservation_id);

-- Le catalogue Bébé & Maman interdit côté serveur les catégories/produits prohibés.
create or replace function public.guard_baby_mama_catalog_terms()
returns trigger language plpgsql set search_path=public,extensions
as $function$
declare normalized text;
begin
  if new.universe_slug <> 'bebe-maman' then return new; end if;
  normalized := lower(unaccent(concat_ws(' ',new.name,new.brand,new.category,new.description)));
  if normalized ~ '(^|[^a-z])(formula|formulas|infant[[:space:]-]+cereals?|baby[[:space:]-]+cereals?|bottles?|teats?|pacifiers?|infant[[:space:]-]+formula|lait[[:space:]-]+infantile|biberons?|tetines?|sucettes?|cereales[[:space:]-]+infantiles?)([^a-z]|$)' then
    raise exception 'Ce produit n’est pas autorisé dans le catalogue Bébé & Maman' using errcode='23514';
  end if;
  return new;
end;
$function$;
drop trigger if exists partner_products_baby_terms_guard on public.partner_products;
create trigger partner_products_baby_terms_guard
before insert or update of universe_slug,name,brand,category,description
on public.partner_products for each row execute function public.guard_baby_mama_catalog_terms();

alter table public.partner_products enable row level security;
alter table public.universe_reservations enable row level security;
alter table public.universe_reservation_items enable row level security;

drop policy if exists partner_products_public_active_read on public.partner_products;
create policy partner_products_public_active_read on public.partner_products
for select to anon,authenticated using (
  status='active'
  and (expires_at is null or expires_at >= current_date)
  and exists (select 1 from public.partners pa where pa.id=partner_id and pa.status='active')
  and exists (select 1 from public.partner_universes pu where pu.partner_id=partner_id and pu.universe_slug=partner_products.universe_slug and pu.enabled=true)
  and exists (select 1 from public.universes u where u.slug=partner_products.universe_slug and u.enabled=true)
  and exists (select 1 from public.feature_flags ff where ff.flag_key='universe.'||partner_products.universe_slug and ff.enabled=true)
);
drop policy if exists partner_products_admin_all on public.partner_products;
create policy partner_products_admin_all on public.partner_products for all to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists partner_products_member_manage on public.partner_products;
create policy partner_products_member_manage on public.partner_products for all to authenticated
using (exists (select 1 from public.partner_members pm where pm.partner_id=partner_products.partner_id and pm.user_id=auth.uid() and pm.member_role in ('owner','manager','operator')))
with check (exists (select 1 from public.partner_members pm where pm.partner_id=partner_products.partner_id and pm.user_id=auth.uid() and pm.member_role in ('owner','manager','operator')));

drop policy if exists universe_reservations_client_read on public.universe_reservations;
create policy universe_reservations_client_read on public.universe_reservations for select to authenticated using (client_id=auth.uid());
drop policy if exists universe_reservations_partner_read on public.universe_reservations;
create policy universe_reservations_partner_read on public.universe_reservations for select to authenticated
using (exists (select 1 from public.partner_members pm where pm.partner_id=universe_reservations.partner_id and pm.user_id=auth.uid()));
drop policy if exists universe_reservations_admin_read on public.universe_reservations;
create policy universe_reservations_admin_read on public.universe_reservations for select to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

drop policy if exists universe_reservation_items_client_read on public.universe_reservation_items;
create policy universe_reservation_items_client_read on public.universe_reservation_items for select to authenticated
using (exists (select 1 from public.universe_reservations r where r.id=reservation_id and (r.client_id=auth.uid() or exists (select 1 from public.partner_members pm where pm.partner_id=r.partner_id and pm.user_id=auth.uid()) or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))));

-- Une réservation verrouille les lignes produit dans un ordre déterministe avant de vérifier
-- le stock disponible (stock physique moins les quantités encore réservées).
create or replace function public.reserve_universe_products(p_partner_id uuid,p_universe_slug text,p_items jsonb,p_note text default null)
returns uuid language plpgsql security definer set search_path=public,extensions
as $function$
declare
  uid uuid := auth.uid();
  rid uuid;
  item jsonb;
  prod public.partner_products%rowtype;
  qty integer;
  reserved numeric;
  total integer := 0;
  item_count integer;
  distinct_count integer;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  if p_universe_slug not in ('parapharmacie','bebe-maman') then raise exception 'Univers non autorisé'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Liste de produits invalide'; end if;
  select count(*),count(distinct x.product_id) into item_count,distinct_count
    from (select (v->>'product_id')::uuid product_id from jsonb_array_elements(p_items) v) x;
  if item_count < 1 or item_count > 20 or item_count <> distinct_count then raise exception 'Panier invalide'; end if;
  if not exists (
    select 1 from public.partners pa
    join public.partner_universes pu on pu.partner_id=pa.id and pu.universe_slug=p_universe_slug and pu.enabled
    join public.universes u on u.slug=p_universe_slug and u.enabled
    join public.feature_flags ff on ff.flag_key='universe.'||p_universe_slug and ff.enabled
    where pa.id=p_partner_id and pa.status='active'
  ) then raise exception 'Partenaire indisponible'; end if;
  for item in select v from jsonb_array_elements(p_items) v order by (v->>'product_id')::uuid loop
    qty := (item->>'quantity')::integer;
    if qty < 1 or qty > 10 then raise exception 'Quantité invalide'; end if;
    select * into prod from public.partner_products
      where id=(item->>'product_id')::uuid and partner_id=p_partner_id
        and universe_slug=p_universe_slug and status='active'
        and (expires_at is null or expires_at >= current_date)
      for update;
    if not found then raise exception 'Produit indisponible'; end if;
    select coalesce(sum(ri.quantity),0) into reserved
      from public.universe_reservation_items ri join public.universe_reservations r on r.id=ri.reservation_id
      where ri.product_id=prod.id and r.status in ('requested','confirmed','ready') and r.expires_at>now();
    if prod.stock_quantity-reserved < qty then raise exception 'Stock insuffisant pour : %',prod.name; end if;
    total := total + prod.price_fcfa*qty;
  end loop;
  insert into public.universe_reservations(client_id,partner_id,universe_slug,total_fcfa,client_note)
  values(uid,p_partner_id,p_universe_slug,total,left(nullif(trim(p_note),''),500)) returning id into rid;
  for item in select v from jsonb_array_elements(p_items) v order by (v->>'product_id')::uuid loop
    qty := (item->>'quantity')::integer;
    select * into prod from public.partner_products where id=(item->>'product_id')::uuid for update;
    insert into public.universe_reservation_items(reservation_id,product_id,product_name,unit_price_fcfa,quantity,line_total_fcfa)
    values(rid,prod.id,prod.name,prod.price_fcfa,qty,prod.price_fcfa*qty);
  end loop;
  return rid;
end;
$function$;

create or replace function public.transition_universe_reservation(p_reservation_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public,extensions
as $function$
declare
  uid uuid := auth.uid();
  r public.universe_reservations%rowtype;
  it record;
  is_admin boolean;
  can_manage boolean;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select * into r from public.universe_reservations where id=p_reservation_id for update;
  if not found then raise exception 'Réservation introuvable'; end if;
  select exists(select 1 from public.profiles p where p.id=uid and p.role='admin') into is_admin;
  select exists(select 1 from public.partner_members pm where pm.partner_id=r.partner_id and pm.user_id=uid and pm.member_role in ('owner','manager','operator')) into can_manage;

  if p_status='cancelled' and r.client_id=uid and r.status in ('requested','confirmed') then
    update public.universe_reservations set status='cancelled',updated_at=now() where id=r.id;
    return;
  end if;
  if not (is_admin or can_manage) then raise exception 'Action non autorisée'; end if;
  if r.status in ('picked_up','cancelled','expired') then raise exception 'Réservation déjà clôturée'; end if;
  if p_status='confirmed' and r.status='requested' then
    update public.universe_reservations set status='confirmed',updated_at=now() where id=r.id;
  elsif p_status='ready' and r.status in ('requested','confirmed') then
    update public.universe_reservations set status='ready',updated_at=now() where id=r.id;
  elsif p_status='picked_up' and r.status='ready' then
    for it in select ri.product_id,ri.quantity,pp.stock_quantity from public.universe_reservation_items ri
      join public.partner_products pp on pp.id=ri.product_id where ri.reservation_id=r.id order by ri.product_id for update of pp
    loop
      if it.stock_quantity < it.quantity then raise exception 'Stock physique insuffisant lors du retrait'; end if;
      update public.partner_products set stock_quantity=stock_quantity-it.quantity,updated_at=now() where id=it.product_id;
      insert into public.stock_movements(partner_id,product_id,quantity_delta,movement_type,reason,reference,created_by)
      values(r.partner_id,it.product_id,-it.quantity,'sale','Retrait confirmé',r.id::text,uid);
    end loop;
    update public.universe_reservations set status='picked_up',picked_up_at=now(),updated_at=now() where id=r.id;
  else
    raise exception 'Transition de statut non autorisée';
  end if;
end;
$function$;

revoke all on function public.reserve_universe_products(uuid,text,jsonb,text) from public,anon;
grant execute on function public.reserve_universe_products(uuid,text,jsonb,text) to authenticated;
revoke all on function public.transition_universe_reservation(uuid,text) from public,anon;
grant execute on function public.transition_universe_reservation(uuid,text) to authenticated;

revoke all on public.partner_products,public.universe_reservations,public.universe_reservation_items from anon,public;
grant select on public.partner_products to anon,authenticated;
grant select,insert,update on public.partner_products to authenticated;
grant select on public.universe_reservations,public.universe_reservation_items to authenticated;

commit;

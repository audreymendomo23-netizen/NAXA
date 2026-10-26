begin;

-- Resolve the pharmacy that owns a Baby & Maman service for an existing product partner.
-- Ambiguous ownership intentionally returns NULL: never route a reservation to an arbitrary pharmacy.
create or replace function public.bebe_maman_pharmacie_pour_partenaire(p_partner_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with owners as (
    select pm.user_id as owner_id
    from public.partner_members pm
    where pm.partner_id = p_partner_id
    union
    select d.promoteur_id
    from public.admin_partner_dossiers d
    where d.partner_id = p_partner_id
  ),
  eligible as (
    select distinct ph.id
    from owners o
    join public.promoteur_pharmacies pp on pp.promoteur_id = o.owner_id and pp.actif = true
    join public.pharmacies ph on ph.id = pp.pharmacie_id and ph.actif = true and ph.visible_recherche = true
    join public.pharmacie_services ps on ps.pharmacie_id = ph.id
      and ps.service_slug = 'bebe-maman' and ps.status = 'active'
  )
  select case when count(*) = 1 then min(id::text)::uuid else null end
  from eligible;
$$;

revoke all on function public.bebe_maman_pharmacie_pour_partenaire(uuid) from public, anon, authenticated;
grant execute on function public.bebe_maman_pharmacie_pour_partenaire(uuid) to service_role;

-- Persist the pharmacy ownership on each Baby & Maman product, not only at display time.
alter table public.partner_products
  add column if not exists pharmacie_id uuid references public.pharmacies(id) on delete restrict;

update public.partner_products pp
set pharmacie_id = public.bebe_maman_pharmacie_pour_partenaire(pp.partner_id),
    status = case
      when public.bebe_maman_pharmacie_pour_partenaire(pp.partner_id) is null then 'inactive'
      else pp.status
    end
where pp.universe_slug = 'bebe-maman';

create index if not exists partner_products_pharmacie_universe_status_idx
  on public.partner_products(pharmacie_id, universe_slug, status)
  where pharmacie_id is not null;

alter table public.partner_products
  drop constraint if exists partner_products_bebe_maman_pharmacie_required;
alter table public.partner_products
  add constraint partner_products_bebe_maman_pharmacie_required
  check (universe_slug <> 'bebe-maman' or status <> 'active' or pharmacie_id is not null);

create or replace function public.sync_bebe_maman_product_pharmacy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
begin
  if new.universe_slug = 'bebe-maman' then
    new.pharmacie_id := public.bebe_maman_pharmacie_pour_partenaire(new.partner_id);
    if new.pharmacie_id is null then
      raise exception 'Un produit Bébé & Maman doit appartenir à une pharmacie unique ayant activé le service';
    end if;
  else
    new.pharmacie_id := null;
  end if;
  return new;
end;
$;
revoke all on function public.sync_bebe_maman_product_pharmacy() from public, anon, authenticated;
drop trigger if exists sync_bebe_maman_product_pharmacy on public.partner_products;
create trigger sync_bebe_maman_product_pharmacy
before insert or update of partner_id, universe_slug on public.partner_products
for each row execute function public.sync_bebe_maman_product_pharmacy();

alter table public.universe_reservations
  add column if not exists pharmacie_id uuid references public.pharmacies(id) on delete restrict;
create index if not exists universe_reservations_pharmacie_status_idx
  on public.universe_reservations(pharmacie_id, status, created_at desc)
  where pharmacie_id is not null;

-- Keep the legacy partner_id for compatibility with existing lifecycle/stock functions,
-- but require every new Baby & Maman reservation to resolve to an active pharmacy service.
create or replace function public.get_universe_catalog(p_universe_slug text)
returns table(
  product_id uuid, partner_id uuid, partner_name text, universe_slug text,
  name text, brand text, category text, description text, photo_url text,
  price_fcfa integer, available_quantity numeric, unit_label text
)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
  select pp.id, pa.id,
         case when pp.universe_slug = 'bebe-maman' then ph.nom else pa.name end,
         pp.universe_slug, pp.name, pp.brand, pp.category, pp.description,
         pp.photo_url, pp.price_fcfa,
         greatest(0, pp.stock_quantity - coalesce(reserved.quantity_reserved, 0)),
         pp.unit_label
  from public.partner_products pp
  join public.partners pa on pa.id = pp.partner_id and pa.status = 'active'
  join public.partner_universes pu on pu.partner_id = pa.id and pu.universe_slug = pp.universe_slug and pu.enabled = true
  join public.universes u on u.slug = pp.universe_slug and u.enabled = true
  join public.feature_flags ff on ff.flag_key = 'universe.' || pp.universe_slug and ff.enabled = true
  left join lateral (
    select sum(ri.quantity)::numeric quantity_reserved
    from public.universe_reservation_items ri
    join public.universe_reservations r on r.id = ri.reservation_id
    where ri.product_id = pp.id
      and r.status in ('requested','confirmed','ready')
      and r.expires_at > now()
  ) reserved on true
  left join public.pharmacies ph
    on pp.universe_slug = 'bebe-maman'
   and ph.id = pp.pharmacie_id
  where pp.universe_slug = p_universe_slug
    and p_universe_slug in ('parapharmacie','bebe-maman')
    and pp.status = 'active'
    and (pp.expires_at is null or pp.expires_at >= current_date)
    and pp.stock_quantity - coalesce(reserved.quantity_reserved, 0) > 0
    and (pp.universe_slug <> 'bebe-maman' or ph.id is not null)
  order by pp.category, pp.name, pa.name;
$function$;

create or replace function public.reserve_universe_products(
  p_partner_id uuid,
  p_universe_slug text,
  p_items jsonb,
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path to 'public', 'extensions'
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
  v_pharmacie_id uuid;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  if p_universe_slug not in ('parapharmacie','bebe-maman') then raise exception 'Univers non autorisé'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Liste de produits invalide'; end if;
  select count(*), count(distinct x.product_id) into item_count, distinct_count
  from (select (v->>'product_id')::uuid product_id from jsonb_array_elements(p_items) v) x;
  if item_count < 1 or item_count > 20 or item_count <> distinct_count then raise exception 'Panier invalide'; end if;

  if not exists (
    select 1 from public.partners pa
    join public.partner_universes pu on pu.partner_id=pa.id and pu.universe_slug=p_universe_slug and pu.enabled
    join public.universes u on u.slug=p_universe_slug and u.enabled
    join public.feature_flags ff on ff.flag_key='universe.'||p_universe_slug and ff.enabled
    where pa.id=p_partner_id and pa.status='active'
  ) then raise exception 'Partenaire indisponible'; end if;

  if p_universe_slug = 'bebe-maman' then
    v_pharmacie_id := public.bebe_maman_pharmacie_pour_partenaire(p_partner_id);
    if v_pharmacie_id is null then raise exception 'Aucune pharmacie unique avec le service Bébé & Maman actif'; end if;
  end if;

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
    from public.universe_reservation_items ri
    join public.universe_reservations r on r.id=ri.reservation_id
    where ri.product_id=prod.id and r.status in ('requested','confirmed','ready') and r.expires_at>now();
    if prod.stock_quantity-reserved < qty then raise exception 'Stock insuffisant pour : %',prod.name; end if;
    total := total + prod.price_fcfa*qty;
  end loop;

  insert into public.universe_reservations(client_id,partner_id,universe_slug,total_fcfa,client_note,pharmacie_id)
  values(uid,p_partner_id,p_universe_slug,total,left(nullif(trim(p_note),''),500),v_pharmacie_id)
  returning id into rid;

  for item in select v from jsonb_array_elements(p_items) v order by (v->>'product_id')::uuid loop
    qty := (item->>'quantity')::integer;
    select * into prod from public.partner_products where id=(item->>'product_id')::uuid for update;
    insert into public.universe_reservation_items(reservation_id,product_id,product_name,unit_price_fcfa,quantity,line_total_fcfa)
    values(rid,prod.id,prod.name,prod.price_fcfa,qty,prod.price_fcfa*qty);
  end loop;
  return rid;
end;
$function$;

-- Keep the established permission model; the functions still perform their own identity and scope checks.
revoke all on function public.get_universe_catalog(text) from public;
grant execute on function public.get_universe_catalog(text) to anon, authenticated, service_role;
revoke all on function public.reserve_universe_products(uuid,text,jsonb,text) from public, anon;
grant execute on function public.reserve_universe_products(uuid,text,jsonb,text) to authenticated, service_role;

create or replace function public.get_universe_reservation_receipt(p_reservation_id uuid)
returns table(
  reservation_id uuid, status text, total_fcfa integer, pickup_code text,
  expires_at timestamptz, created_at timestamptz, partner_name text,
  universe_slug text, items jsonb
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  r public.universe_reservations%rowtype;
  allowed boolean;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select * into r from public.universe_reservations where id=p_reservation_id;
  if not found then raise exception 'Réservation introuvable'; end if;
  select (r.client_id=uid)
    or exists(select 1 from public.partner_members pm where pm.partner_id=r.partner_id and pm.user_id=uid)
    or exists(select 1 from public.profiles p where p.id=uid and p.role='admin')
    or exists(select 1 from public.promoteur_pharmacies pp where pp.pharmacie_id=r.pharmacie_id and pp.promoteur_id=uid and pp.actif=true)
    into allowed;
  if not allowed then raise exception 'Accès refusé'; end if;

  return query
  select r.id,
    case when r.expires_at<=now() and r.status in ('requested','confirmed','ready') then 'expired' else r.status end,
    r.total_fcfa,r.pickup_code,r.expires_at,r.created_at,
    case when r.universe_slug='bebe-maman' and r.pharmacie_id is not null then ph.nom else pa.name end,
    r.universe_slug,
    coalesce((select jsonb_agg(jsonb_build_object(
      'product_name',ri.product_name,'unit_price_fcfa',ri.unit_price_fcfa,
      'quantity',ri.quantity,'line_total_fcfa',ri.line_total_fcfa
    ) order by ri.product_name) from public.universe_reservation_items ri where ri.reservation_id=r.id),'[]'::jsonb)
  from public.partners pa
  left join public.pharmacies ph on ph.id=r.pharmacie_id
  where pa.id=r.partner_id;
end;
$function$;

revoke all on function public.get_universe_reservation_receipt(uuid) from public, anon;
grant execute on function public.get_universe_reservation_receipt(uuid) to authenticated, service_role;

commit;

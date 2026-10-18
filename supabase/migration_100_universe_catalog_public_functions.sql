-- NAXA 100 — fonctions publiques à projection minimale et correction RLS du catalogue.
-- Dépend de la migration 099. Aucun accès public aux coordonnées privées des partenaires.
begin;

create or replace function public.universe_partner_is_public(p_partner_id uuid,p_universe_slug text)
returns boolean
language sql stable security definer set search_path=public
as $function$
  select exists (
    select 1
    from public.partners pa
    join public.partner_universes pu on pu.partner_id=pa.id
    join public.universes u on u.slug=pu.universe_slug
    join public.feature_flags ff on ff.flag_key='universe.'||pu.universe_slug
    where pa.id=p_partner_id
      and pa.status='active'
      and pu.universe_slug=p_universe_slug
      and pu.enabled=true
      and u.enabled=true
      and ff.enabled=true
  );
$function$;
revoke all on function public.universe_partner_is_public(uuid,text) from public;
grant execute on function public.universe_partner_is_public(uuid,text) to anon,authenticated;

drop policy if exists partner_products_public_active_read on public.partner_products;
create policy partner_products_public_active_read on public.partner_products
for select to anon,authenticated using (
  status='active'
  and (expires_at is null or expires_at >= current_date)
  and public.universe_partner_is_public(partner_id,universe_slug)
);

create or replace function public.get_universe_catalog(p_universe_slug text)
returns table(
  product_id uuid,
  partner_id uuid,
  partner_name text,
  universe_slug text,
  name text,
  brand text,
  category text,
  description text,
  photo_url text,
  price_fcfa integer,
  available_quantity numeric,
  unit_label text
)
language sql stable security definer set search_path=public,extensions
as $function$
  select pp.id,pa.id,pa.name,pp.universe_slug,pp.name,pp.brand,pp.category,pp.description,
         pp.photo_url,pp.price_fcfa,
         greatest(0,pp.stock_quantity-coalesce(reserved.quantity_reserved,0)),
         pp.unit_label
  from public.partner_products pp
  join public.partners pa on pa.id=pp.partner_id and pa.status='active'
  join public.partner_universes pu on pu.partner_id=pa.id and pu.universe_slug=pp.universe_slug and pu.enabled=true
  join public.universes u on u.slug=pp.universe_slug and u.enabled=true
  join public.feature_flags ff on ff.flag_key='universe.'||pp.universe_slug and ff.enabled=true
  left join lateral (
    select sum(ri.quantity)::numeric quantity_reserved
    from public.universe_reservation_items ri
    join public.universe_reservations r on r.id=ri.reservation_id
    where ri.product_id=pp.id
      and r.status in ('requested','confirmed','ready')
      and r.expires_at>now()
  ) reserved on true
  where pp.universe_slug=p_universe_slug
    and p_universe_slug in ('parapharmacie','bebe-maman')
    and pp.status='active'
    and (pp.expires_at is null or pp.expires_at>=current_date)
    and pp.stock_quantity-coalesce(reserved.quantity_reserved,0)>0
  order by pp.category,pp.name,pa.name;
$function$;
revoke all on function public.get_universe_catalog(text) from public;
grant execute on function public.get_universe_catalog(text) to anon,authenticated;

commit;

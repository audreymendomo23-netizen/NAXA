begin;

-- Read-only catalogue contract for the unified client cart.
-- It exposes the pharmacy owner needed to route Baby & Mom items without
-- changing the legacy reservation lifecycle or Parapharmacy RBAC.
create or replace function public.get_universe_catalog_for_cart(p_universe_slug text)
returns table(
  product_id uuid,
  partner_id uuid,
  pharmacie_id uuid,
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
language sql
stable
security definer
set search_path = ''
as $function$
  select
    pp.id,
    pp.partner_id,
    pp.pharmacie_id,
    case when pp.universe_slug = 'bebe-maman' then ph.nom else pa.name end,
    pp.universe_slug,
    pp.name,
    pp.brand,
    pp.category,
    pp.description,
    pp.photo_url,
    pp.price_fcfa,
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
   and ph.actif = true and ph.visible_recherche = true
  left join public.pharmacie_services ps
    on ps.pharmacie_id = ph.id and ps.service_slug = 'bebe-maman' and ps.status = 'active'
  where pp.universe_slug = p_universe_slug
    and p_universe_slug in ('parapharmacie','bebe-maman')
    and pp.status = 'active'
    and (pp.expires_at is null or pp.expires_at >= current_date)
    and pp.stock_quantity - coalesce(reserved.quantity_reserved, 0) > 0
    and (
      pp.universe_slug <> 'bebe-maman'
      or (pp.pharmacie_id is not null and ph.id is not null and ps.pharmacie_id is not null)
    )
  order by pp.category, pp.name, pa.name;
$function$;

revoke all on function public.get_universe_catalog_for_cart(text) from public;
grant execute on function public.get_universe_catalog_for_cart(text) to anon, authenticated, service_role;

commit;

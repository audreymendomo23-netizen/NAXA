-- NAXA — harden SECURITY DEFINER catalog helpers without changing their public result sets.
-- All referenced relations are schema-qualified, so an empty search_path is safe.
begin;

create or replace function public.get_home_service_catalog()
returns table(
  offer_id uuid,
  partner_id uuid,
  partner_name text,
  city text,
  neighborhood text,
  name text,
  category text,
  description text,
  service_area_label text,
  price_fcfa integer
)
language sql
stable
security definer
set search_path = ''
as $function$
  select o.id,p.id,p.name,p.city,p.neighborhood,o.name,o.category,o.description,o.service_area_label,o.price_fcfa
  from public.home_service_offers o
  join public.partners p on p.id=o.partner_id and p.status='active' and p.partner_type='professionnel_domicile'
  join public.partner_universes pu on pu.partner_id=p.id and pu.universe_slug='prestations' and pu.enabled=true
  join public.universes u on u.slug='prestations' and u.enabled=true
  join public.feature_flags ff on ff.flag_key='universe.prestations' and ff.enabled=true
  where o.status='active'
  order by o.category,o.name,p.name;
$function$;

create or replace function public.universe_partner_is_public(p_partner_id uuid, p_universe_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
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

commit;

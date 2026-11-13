create or replace function private.get_home_service_catalog_for_client()
returns table(
  offer_id uuid,partner_id uuid,partner_name text,city text,neighborhood text,
  name text,category text,description text,service_area_label text,price_fcfa integer,
  specialty text,available_today boolean,available_now boolean,
  today_opens_at time without time zone,today_closes_at time without time zone
)
language sql stable security definer set search_path=''
as $function$
  select
    o.id,p.id,p.name,p.city,p.neighborhood,o.name,o.category,o.description,o.service_area_label,o.price_fcfa,
    coalesce(nullif(trim(provider.specialty),''),nullif(trim(o.category),'')),
    coalesce(provider.is_open and timezone('Africa/Douala',now())::time < provider.closes_at,false),
    coalesce(provider.is_open
      and timezone('Africa/Douala',now())::time >= provider.opens_at
      and timezone('Africa/Douala',now())::time < provider.closes_at,false),
    case when provider.is_open then provider.opens_at else null end,
    case when provider.is_open then provider.closes_at else null end
  from public.home_service_offers o
  join public.partners p on p.id=o.partner_id and p.status='active' and p.partner_type='professionnel_domicile'
  join public.partner_universes pu on pu.partner_id=p.id and pu.universe_slug='prestations' and pu.enabled=true
  join public.universes u on u.slug='prestations' and u.enabled=true
  join public.feature_flags ff on ff.flag_key='universe.prestations' and ff.enabled=true
  left join lateral (
    select sp.specialty,av.is_open,av.opens_at,av.closes_at
    from public.partner_members pm
    join public.profiles account on account.id=pm.user_id and account.actif=true
    left join public.suivi_professionals sp on sp.user_id=pm.user_id
    left join public.suivi_professional_weekly_availability av
      on av.user_id=pm.user_id and av.weekday=extract(isodow from timezone('Africa/Douala',now()))::smallint
    where pm.partner_id=p.id and pm.member_role in ('owner','manager','operator')
    order by coalesce(av.is_open,false) desc,
      case pm.member_role when 'owner' then 0 when 'manager' then 1 else 2 end,pm.created_at
    limit 1
  ) provider on true
  where o.status='active'
  order by o.category,o.name,p.name;
$function$;

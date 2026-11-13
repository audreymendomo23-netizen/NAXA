-- Aligne la recherche GPS sur le catalogue privé canonique et verrouille les droits Data API.
create or replace function public.get_home_service_catalog_nearby(
  p_latitude double precision,p_longitude double precision,p_radius_km double precision default 25
)
returns table(
  offer_id uuid,partner_id uuid,partner_name text,city text,neighborhood text,
  name text,category text,description text,service_area_label text,price_fcfa integer,distance_km double precision
)
language plpgsql stable security definer set search_path=''
as $function$
begin
  if p_latitude is null or p_longitude is null or p_latitude not between -90 and 90
    or p_longitude not between -180 and 180 or p_radius_km is null or p_radius_km not between 1 and 100 then
    raise exception 'Paramètres de proximité invalides' using errcode='22023';
  end if;
  return query
  select c.offer_id,c.partner_id,c.partner_name,c.city,c.neighborhood,
    c.name,c.category,c.description,c.service_area_label,c.price_fcfa,
    round(d.distance_km::numeric,1)::double precision
  from private.get_home_service_catalog() c
  join public.partners p on p.id=c.partner_id
  cross join lateral (
    select 6371.0 * 2.0 * asin(least(1.0,sqrt(greatest(0.0,
      power(sin(radians((p.latitude::double precision-p_latitude)/2.0)),2)
      + cos(radians(p_latitude))*cos(radians(p.latitude::double precision))
        * power(sin(radians((p.longitude::double precision-p_longitude)/2.0)),2)
    )))) as distance_km
  ) d
  where p.latitude is not null and p.longitude is not null and d.distance_km<=p_radius_km
  order by d.distance_km,c.category,c.name,c.partner_name;
end;
$function$;

revoke all on function public.get_home_service_catalog_nearby(double precision,double precision,double precision) from public,anon,authenticated;
grant execute on function public.get_home_service_catalog_nearby(double precision,double precision,double precision) to service_role;

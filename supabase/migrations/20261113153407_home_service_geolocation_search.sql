-- NAXA — recherche à proximité et partage GPS facultatif des demandes à domicile.
-- Le catalogue public ne reçoit que la distance, jamais les coordonnées privées du professionnel.
-- La position du client n'est enregistrée que sur consentement explicite.

begin;

alter table public.home_service_request_addresses
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists accuracy_m double precision,
  add column if not exists location_shared_at timestamptz;

do $constraints$
begin
  if not exists(select 1 from pg_constraint where conrelid='public.home_service_request_addresses'::regclass and conname='home_service_request_addresses_location_check') then
    alter table public.home_service_request_addresses add constraint home_service_request_addresses_location_check
    check (
      (latitude is null and longitude is null and accuracy_m is null and location_shared_at is null)
      or (latitude between -90 and 90 and longitude between -180 and 180
        and accuracy_m between 0 and 10000 and location_shared_at is not null)
    );
  end if;
end
$constraints$;

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

drop function if exists public.request_home_service_with_location(uuid,text,text,text,timestamptz,text,double precision,double precision,double precision);

create or replace function public.request_home_service_with_location(
  p_client_id uuid,
  p_offer_id uuid,p_area_label text,p_exact_address text,p_contact_phone text,
  p_preferred_at timestamptz,p_client_note text,
  p_shared_latitude double precision,p_shared_longitude double precision,p_accuracy_m double precision
)
returns uuid
language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid:=p_client_id;
  v_offer public.home_service_offers%rowtype;
  v_partner public.partners%rowtype;
  v_request_id uuid;
  v_location_shared_at timestamptz;
begin
  if v_uid is null then raise exception 'Identité client requise' using errcode='28000'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_uid and p.role='client') then
    raise exception 'Compte client requis' using errcode='42501';
  end if;
  if p_offer_id is null or length(trim(coalesce(p_area_label,''))) not between 2 and 180
    or length(trim(coalesce(p_exact_address,''))) not between 5 and 500
    or length(trim(coalesce(p_contact_phone,''))) not between 7 and 40
    or length(coalesce(p_client_note,''))>500 or (p_preferred_at is not null and p_preferred_at<=now())
    or ((p_shared_latitude is null)<>(p_shared_longitude is null))
    or (p_shared_latitude is null and p_accuracy_m is not null)
    or (p_shared_latitude is not null and (
      p_shared_latitude not between -90 and 90 or p_shared_longitude not between -180 and 180
      or p_accuracy_m is null or p_accuracy_m not between 0 and 10000
    )) then
    raise exception 'Informations de demande invalides' using errcode='22023';
  end if;

  select * into v_offer from public.home_service_offers where id=p_offer_id and status='active';
  if not found then raise exception 'Prestation indisponible'; end if;
  select * into v_partner from public.partners where id=v_offer.partner_id and status='active'
    and partner_type='professionnel_domicile';
  if not found or not public.universe_partner_is_public(v_partner.id,'prestations') then
    raise exception 'Professionnel indisponible';
  end if;

  if p_shared_latitude is not null then v_location_shared_at:=now(); end if;
  insert into public.home_service_requests(client_id,partner_id,offer_id,offer_name,category,price_fcfa,service_area_label,preferred_at,client_note)
  values(v_uid,v_partner.id,v_offer.id,v_offer.name,v_offer.category,v_offer.price_fcfa,
    left(trim(p_area_label),180),p_preferred_at,nullif(left(trim(coalesce(p_client_note,'')),500),'')) returning id into v_request_id;

  insert into public.home_service_request_addresses(request_id,client_id,exact_address,contact_phone,latitude,longitude,accuracy_m,location_shared_at)
  values(v_request_id,v_uid,left(trim(p_exact_address),500),left(trim(p_contact_phone),40),
    p_shared_latitude,p_shared_longitude,p_accuracy_m,v_location_shared_at);

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'home_service.requested','home_service_request',v_request_id::text,
    jsonb_build_object('partner_id',v_partner.id,'offer_id',v_offer.id,'area_label',left(trim(p_area_label),180),
      'gps_shared',p_shared_latitude is not null));
  return v_request_id;
end;
$function$;

revoke all on function public.request_home_service_with_location(uuid,uuid,text,text,text,timestamptz,text,double precision,double precision,double precision) from public,anon,authenticated;
grant execute on function public.request_home_service_with_location(uuid,uuid,text,text,text,timestamptz,text,double precision,double precision,double precision) to service_role;

commit;

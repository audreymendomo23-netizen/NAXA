-- NAXA — localisation du professionnel, planning hebdomadaire et données publiques de disponibilité.
-- La position définie par le professionnel est prioritaire sur la position administrative.
-- Le planning est partagé entre le catalogue Prestations et l'annuaire médical du Suivi connecté.

begin;

alter table public.partners
  add column if not exists provider_latitude numeric,
  add column if not exists provider_longitude numeric,
  add column if not exists provider_location_updated_at timestamptz,
  add column if not exists provider_location_updated_by uuid references auth.users(id) on delete set null,
  add column if not exists admin_location_updated_at timestamptz,
  add column if not exists admin_location_updated_by uuid references auth.users(id) on delete set null;

do $constraints$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.partners'::regclass and conname='partners_provider_coordinates_pair_check') then
    alter table public.partners add constraint partners_provider_coordinates_pair_check
      check ((provider_latitude is null) = (provider_longitude is null));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.partners'::regclass and conname='partners_provider_latitude_range_check') then
    alter table public.partners add constraint partners_provider_latitude_range_check
      check (provider_latitude is null or provider_latitude between -90 and 90);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.partners'::regclass and conname='partners_provider_longitude_range_check') then
    alter table public.partners add constraint partners_provider_longitude_range_check
      check (provider_longitude is null or provider_longitude between -180 and 180);
  end if;
end
$constraints$;

-- Les anciennes coordonnées latitude/longitude restent la position de référence saisie par l'administration.
-- Les coordonnées provider_* représentent le dernier point déclaré par le professionnel et les surchargent.
alter table public.suivi_professionals
  add column if not exists registration_number text,
  add column if not exists issuing_authority text,
  add column if not exists specialty text,
  add column if not exists credential_storage_path text,
  add column if not exists verification_status text not null default 'pending',
  add column if not exists verified_at timestamptz,
  add column if not exists verification_expires_at timestamptz;

update public.suivi_professionals
set verification_status=case when verified then 'verified' else 'pending' end
where verification_status is null
   or (verified=true and verification_status='pending');

alter table public.suivi_professionals
  drop constraint if exists suivi_professionals_verification_status_check;
alter table public.suivi_professionals
  add constraint suivi_professionals_verification_status_check
  check (verification_status in ('pending','verified','rejected','expired'));

alter table public.suivi_professionals
  drop constraint if exists suivi_professionals_professional_role_check;
alter table public.suivi_professionals
  add constraint suivi_professionals_professional_role_check
  check (professional_role in ('medecin','pharmacien','infirmier','sage_femme','chirurgien_dentiste','kinesitherapeute','technicien_laboratoire','autre_sante'));

create table if not exists public.suivi_professional_weekly_availability (
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), -- ISO: lundi=1 ... dimanche=7
  is_open boolean not null default false,
  opens_at time without time zone,
  closes_at time without time zone,
  timezone text not null default 'Africa/Douala' check (timezone='Africa/Douala'),
  updated_at timestamptz not null default now(),
  primary key (user_id,weekday),
  constraint suivi_professional_weekly_availability_hours_check check (
    (is_open=true and opens_at is not null and closes_at is not null and opens_at < closes_at)
    or (is_open=false and opens_at is null and closes_at is null)
  )
);

create index if not exists suivi_professional_weekly_availability_day_idx
  on public.suivi_professional_weekly_availability(weekday,is_open,user_id);

alter table public.suivi_professional_weekly_availability enable row level security;
grant select,insert,update,delete on public.suivi_professional_weekly_availability to authenticated;

drop policy if exists suivi_professional_weekly_availability_self_read on public.suivi_professional_weekly_availability;
create policy suivi_professional_weekly_availability_self_read
  on public.suivi_professional_weekly_availability for select to authenticated
  using (user_id=(select auth.uid()) or public.is_admin());

drop policy if exists suivi_professional_weekly_availability_self_insert on public.suivi_professional_weekly_availability;
create policy suivi_professional_weekly_availability_self_insert
  on public.suivi_professional_weekly_availability for insert to authenticated
  with check (user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.actif=true));

drop policy if exists suivi_professional_weekly_availability_self_update on public.suivi_professional_weekly_availability;
create policy suivi_professional_weekly_availability_self_update
  on public.suivi_professional_weekly_availability for update to authenticated
  using (user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.actif=true))
  with check (user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.actif=true));

drop policy if exists suivi_professional_weekly_availability_self_delete on public.suivi_professional_weekly_availability;
create policy suivi_professional_weekly_availability_self_delete
  on public.suivi_professional_weekly_availability for delete to authenticated
  using (user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.actif=true));

create or replace function private.get_home_service_catalog_for_client()
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
  price_fcfa integer,
  specialty text,
  available_today boolean,
  available_now boolean,
  today_opens_at time without time zone,
  today_closes_at time without time zone
)
language sql stable security definer set search_path=''
as $function$
  select
    o.id,
    p.id,
    p.name,
    p.city,
    p.neighborhood,
    o.name,
    o.category,
    o.description,
    o.service_area_label,
    o.price_fcfa,
    coalesce(nullif(trim(sp.specialty),''),o.category),
    coalesce(av.is_open,false),
    coalesce(
      av.is_open
      and timezone('Africa/Douala',now())::time >= av.opens_at
      and timezone('Africa/Douala',now())::time < av.closes_at,
      false
    ),
    case when av.is_open then av.opens_at else null end,
    case when av.is_open then av.closes_at else null end
  from public.home_service_offers o
  join public.partners p on p.id=o.partner_id and p.status='active' and p.partner_type='professionnel_domicile'
  join public.partner_universes pu on pu.partner_id=p.id and pu.universe_slug='prestations' and pu.enabled=true
  join public.universes u on u.slug='prestations' and u.enabled=true
  join public.feature_flags ff on ff.flag_key='universe.prestations' and ff.enabled=true
  left join public.suivi_professionals sp
    on sp.user_id=o.created_by
    and sp.verified=true
    and sp.verification_status='verified'
    and (sp.verification_expires_at is null or sp.verification_expires_at>now())
  left join public.suivi_professional_weekly_availability av
    on av.user_id=o.created_by
    and av.weekday=extract(isodow from timezone('Africa/Douala',now()))::smallint
  where o.status='active'
  order by o.category,o.name,p.name;
$function$;

revoke all on function private.get_home_service_catalog_for_client() from public,anon,authenticated;
grant execute on function private.get_home_service_catalog_for_client() to anon,authenticated,service_role;

create or replace function public.get_home_service_catalog_for_client()
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
  price_fcfa integer,
  specialty text,
  available_today boolean,
  available_now boolean,
  today_opens_at time without time zone,
  today_closes_at time without time zone
)
language sql stable set search_path=''
as $function$
  select * from private.get_home_service_catalog_for_client();
$function$;

revoke all on function public.get_home_service_catalog_for_client() from public;
grant execute on function public.get_home_service_catalog_for_client() to anon,authenticated;

create or replace function public.get_home_service_catalog_nearby(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_km double precision default 25
)
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
  price_fcfa integer,
  distance_km double precision
)
language plpgsql stable security definer set search_path=''
as $function$
begin
  if p_latitude is null or p_longitude is null
    or p_latitude not between -90 and 90
    or p_longitude not between -180 and 180
    or p_radius_km is null or p_radius_km not between 1 and 100 then
    raise exception 'Paramètres de proximité invalides' using errcode='22023';
  end if;

  return query
  select c.offer_id,c.partner_id,c.partner_name,c.city,c.neighborhood,
    c.name,c.category,c.description,c.service_area_label,c.price_fcfa,
    round(d.distance_km::numeric,1)::double precision as distance_km
  from private.get_home_service_catalog_for_client() c
  join public.partners p on p.id=c.partner_id
  cross join lateral (
    select 6371.0 * 2.0 * asin(
      least(1.0,sqrt(greatest(0.0,
        power(sin(radians((coalesce(p.provider_latitude,p.latitude)::double precision-p_latitude)/2.0)),2)
        + cos(radians(p_latitude))*cos(radians(coalesce(p.provider_latitude,p.latitude)::double precision))
          * power(sin(radians((coalesce(p.provider_longitude,p.longitude)::double precision-p_longitude)/2.0)),2)
      )))
    ) as distance_km
  ) d
  where coalesce(p.provider_latitude,p.latitude) is not null
    and coalesce(p.provider_longitude,p.longitude) is not null
    and d.distance_km <= p_radius_km
  order by d.distance_km,c.category,c.name,c.partner_name;
end;
$function$;

revoke all on function public.get_home_service_catalog_nearby(double precision,double precision,double precision) from public,anon,authenticated;
grant execute on function public.get_home_service_catalog_nearby(double precision,double precision,double precision) to service_role;

commit;

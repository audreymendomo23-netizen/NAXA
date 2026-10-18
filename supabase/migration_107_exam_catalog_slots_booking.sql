-- NAXA 107 — catalogue d’examens, packs, créneaux et réservations atomiques.
-- Migration additive : ne modifie pas les tables du parcours pharmacie.
begin;

create table if not exists public.exam_centers (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null unique references public.partners(id) on delete restrict,
  display_name text not null check (length(trim(display_name)) between 2 and 180),
  address_label text not null default '',
  phone_public text,
  status text not null default 'draft' check (status in ('draft','active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exam_services (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.exam_centers(id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 180),
  description text,
  category text not null default 'Autres',
  price_fcfa integer not null check (price_fcfa >= 0),
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 240),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists exam_services_public_idx on public.exam_services(center_id,status,category,name);

create table if not exists public.exam_packs (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.exam_centers(id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 180),
  description text,
  price_fcfa integer not null check (price_fcfa >= 0),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.exam_pack_items (
  pack_id uuid not null references public.exam_packs(id) on delete restrict,
  service_id uuid not null references public.exam_services(id) on delete restrict,
  primary key(pack_id,service_id)
);

create table if not exists public.exam_center_hours (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.exam_centers(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  slot_minutes integer not null default 30 check (slot_minutes between 5 and 240),
  capacity integer not null default 1 check (capacity between 1 and 500),
  enabled boolean not null default true,
  check (closes_at > opens_at),
  unique(center_id,weekday,opens_at)
);

create table if not exists public.exam_slots (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.exam_centers(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  reserved_count integer not null default 0 check (reserved_count >= 0 and reserved_count <= capacity),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique(center_id,starts_at)
);
create index if not exists exam_slots_open_idx on public.exam_slots(center_id,starts_at) where status='open';

create table if not exists public.exam_appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete restrict,
  center_id uuid not null references public.exam_centers(id) on delete restrict,
  slot_id uuid not null references public.exam_slots(id) on delete restrict,
  service_id uuid references public.exam_services(id) on delete restrict,
  pack_id uuid references public.exam_packs(id) on delete restrict,
  item_name text not null,
  price_fcfa integer not null check (price_fcfa >= 0),
  status text not null default 'booked' check (status in ('booked','confirmed','completed','cancelled','expired')),
  ticket_code text not null unique default upper(substr(encode(gen_random_bytes(8),'hex'),1,8)),
  reminder_at timestamptz,
  reminder_sent_at timestamptz,
  client_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((service_id is not null)::integer + (pack_id is not null)::integer = 1)
);
create index if not exists exam_appointments_client_idx on public.exam_appointments(client_id,created_at desc);
create index if not exists exam_appointments_center_idx on public.exam_appointments(center_id,status,created_at desc);

alter table public.exam_centers enable row level security;
alter table public.exam_services enable row level security;
alter table public.exam_packs enable row level security;
alter table public.exam_pack_items enable row level security;
alter table public.exam_center_hours enable row level security;
alter table public.exam_slots enable row level security;
alter table public.exam_appointments enable row level security;

drop policy if exists exam_centers_public_read on public.exam_centers;
create policy exam_centers_public_read on public.exam_centers for select to anon,authenticated using (
 status='active' and exists(select 1 from public.partners p where p.id=partner_id and p.status='active')
 and exists(select 1 from public.partner_universes pu where pu.partner_id=partner_id and pu.universe_slug='examens' and pu.enabled=true)
 and exists(select 1 from public.universes u where u.slug='examens' and u.enabled=true)
 and exists(select 1 from public.feature_flags f where f.flag_key='universe.examens' and f.enabled=true)
);
drop policy if exists exam_centers_partner_manage on public.exam_centers;
create policy exam_centers_partner_manage on public.exam_centers for all to authenticated
using(exists(select 1 from public.partner_members pm where pm.partner_id=exam_centers.partner_id and pm.user_id=auth.uid() and pm.member_role in ('owner','manager')))
with check(exists(select 1 from public.partner_members pm where pm.partner_id=exam_centers.partner_id and pm.user_id=auth.uid() and pm.member_role in ('owner','manager')));

drop policy if exists exam_services_public_read on public.exam_services;
create policy exam_services_public_read on public.exam_services for select to anon,authenticated using(status='active' and exists(select 1 from public.exam_centers c where c.id=center_id and c.status='active'));
drop policy if exists exam_services_partner_manage on public.exam_services;
create policy exam_services_partner_manage on public.exam_services for all to authenticated
using(exists(select 1 from public.exam_centers c join public.partner_members pm on pm.partner_id=c.partner_id where c.id=exam_services.center_id and pm.user_id=auth.uid() and pm.member_role in ('owner','manager')))
with check(exists(select 1 from public.exam_centers c join public.partner_members pm on pm.partner_id=c.partner_id where c.id=exam_services.center_id and pm.user_id=auth.uid() and pm.member_role in ('owner','manager')));

drop policy if exists exam_packs_public_read on public.exam_packs;
create policy exam_packs_public_read on public.exam_packs for select to anon,authenticated using(status='active' and exists(select 1 from public.exam_centers c where c.id=center_id and c.status='active'));
drop policy if exists exam_packs_partner_manage on public.exam_packs;
create policy exam_packs_partner_manage on public.exam_packs for all to authenticated
using(exists(select 1 from public.exam_centers c join public.partner_members pm on pm.partner_id=c.partner_id where c.id=exam_packs.center_id and pm.user_id=auth.uid() and pm.member_role in ('owner','manager')))
with check(exists(select 1 from public.exam_centers c join public.partner_members pm on pm.partner_id=c.partner_id where c.id=exam_packs.center_id and pm.user_id=auth.uid() and pm.member_role in ('owner','manager')));

drop policy if exists exam_pack_items_public_read on public.exam_pack_items;
create policy exam_pack_items_public_read on public.exam_pack_items for select to anon,authenticated using(exists(select 1 from public.exam_packs p join public.exam_centers c on c.id=p.center_id where p.id=pack_id and p.status='active' and c.status='active'));
drop policy if exists exam_pack_items_partner_manage on public.exam_pack_items;
create policy exam_pack_items_partner_manage on public.exam_pack_items for all to authenticated
using(exists(select 1 from public.exam_packs p join public.exam_centers c on c.id=p.center_id join public.partner_members pm on pm.partner_id=c.partner_id where p.id=pack_id and pm.user_id=auth.uid() and pm.member_role in ('owner','manager')))
with check(exists(select 1 from public.exam_packs p join public.exam_centers c on c.id=p.center_id join public.partner_members pm on pm.partner_id=c.partner_id where p.id=pack_id and pm.user_id=auth.uid() and pm.member_role in ('owner','manager')));

drop policy if exists exam_hours_partner_manage on public.exam_center_hours;
create policy exam_hours_partner_manage on public.exam_center_hours for all to authenticated
using(exists(select 1 from public.exam_centers c join public.partner_members pm on pm.partner_id=c.partner_id where c.id=exam_center_hours.center_id and pm.user_id=auth.uid() and pm.member_role in ('owner','manager')))
with check(exists(select 1 from public.exam_centers c join public.partner_members pm on pm.partner_id=c.partner_id where c.id=exam_center_hours.center_id and pm.user_id=auth.uid() and pm.member_role in ('owner','manager')));

drop policy if exists exam_slots_public_open_read on public.exam_slots;
create policy exam_slots_public_open_read on public.exam_slots for select to anon,authenticated using(status='open' and starts_at > now() and reserved_count < capacity and exists(select 1 from public.exam_centers c where c.id=center_id and c.status='active'));
drop policy if exists exam_slots_partner_manage on public.exam_slots;
create policy exam_slots_partner_manage on public.exam_slots for all to authenticated
using(exists(select 1 from public.exam_centers c join public.partner_members pm on pm.partner_id=c.partner_id where c.id=exam_slots.center_id and pm.user_id=auth.uid() and pm.member_role in ('owner','manager')))
with check(exists(select 1 from public.exam_centers c join public.partner_members pm on pm.partner_id=c.partner_id where c.id=exam_slots.center_id and pm.user_id=auth.uid() and pm.member_role in ('owner','manager')));

drop policy if exists exam_appointments_client_read on public.exam_appointments;
create policy exam_appointments_client_read on public.exam_appointments for select to authenticated using(client_id=auth.uid());
drop policy if exists exam_appointments_partner_read on public.exam_appointments;
create policy exam_appointments_partner_read on public.exam_appointments for select to authenticated
using(exists(select 1 from public.exam_centers c join public.partner_members pm on pm.partner_id=c.partner_id where c.id=exam_appointments.center_id and pm.user_id=auth.uid()));

create or replace function public.book_exam_appointment(p_slot_id uuid,p_service_id uuid default null,p_pack_id uuid default null,p_client_note text default null)
returns table(appointment_id uuid,ticket_code text,starts_at timestamptz,price_fcfa integer)
language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_slot public.exam_slots%rowtype; v_center uuid; v_name text; v_price integer; v_id uuid; v_ticket text;
begin
 if v_user is null then raise exception 'Connexion requise' using errcode='28000'; end if;
 if (p_service_id is null)::integer + (p_pack_id is null)::integer <> 1 then raise exception 'Choisir un examen ou un pack' using errcode='22023'; end if;
 select * into v_slot from public.exam_slots s where s.id=p_slot_id for update;
 if not found or v_slot.status<>'open' or v_slot.starts_at<=now() or v_slot.reserved_count>=v_slot.capacity then raise exception 'Créneau indisponible' using errcode='P0001'; end if;
 v_center:=v_slot.center_id;
 if p_service_id is not null then
   select s.name,s.price_fcfa into v_name,v_price from public.exam_services s join public.exam_centers c on c.id=s.center_id where s.id=p_service_id and s.center_id=v_center and s.status='active' and c.status='active';
 else
   select p.name,p.price_fcfa into v_name,v_price from public.exam_packs p join public.exam_centers c on c.id=p.center_id where p.id=p_pack_id and p.center_id=v_center and p.status='active' and c.status='active';
 end if;
 if v_name is null then raise exception 'Examen ou pack indisponible dans ce centre' using errcode='P0001'; end if;
 update public.exam_slots set reserved_count=reserved_count+1 where id=p_slot_id and reserved_count<capacity;
 if not found then raise exception 'Créneau complet' using errcode='P0001'; end if;
 insert into public.exam_appointments(client_id,center_id,slot_id,service_id,pack_id,item_name,price_fcfa,reminder_at,client_note)
 values(v_user,v_center,p_slot_id,p_service_id,p_pack_id,v_name,v_price,v_slot.starts_at-interval '24 hours',nullif(left(trim(coalesce(p_client_note,'')),500),''))
 returning id,exam_appointments.ticket_code into v_id,v_ticket;
 return query select v_id,v_ticket,v_slot.starts_at,v_price;
end;$function$;

create or replace function public.generate_exam_slots(p_days integer default 14)
returns integer language plpgsql security definer set search_path=''
as $function$
declare h record; d date; ts timestamp; v_count integer:=0; v_tz text:='Africa/Douala';
begin
 if auth.uid() is not null and not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then
   if not exists(select 1 from public.exam_centers c join public.partner_members pm on pm.partner_id=c.partner_id where pm.user_id=auth.uid() and pm.member_role in ('owner','manager')) then raise exception 'Accès refusé' using errcode='42501'; end if;
 elsif auth.uid() is null and coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then
   raise exception 'Accès refusé' using errcode='42501';
 end if;
 if p_days<1 or p_days>14 then raise exception 'La génération est limitée à 14 jours' using errcode='22023'; end if;
 for h in select c.id center_id, ch.weekday,ch.opens_at,ch.closes_at,ch.slot_minutes,ch.capacity
   from public.exam_center_hours ch join public.exam_centers c on c.id=ch.center_id
   where ch.enabled=true and c.status='active'
     and exists(select 1 from public.exam_services es where es.center_id=c.id and es.status='active')
 loop
   for d in select (current_timestamp at time zone v_tz)::date + g from generate_series(0,p_days-1) g loop
     if extract(dow from d)=h.weekday then
       ts:=d+h.opens_at;
       while ts + make_interval(mins=>h.slot_minutes) <= d+h.closes_at loop
         insert into public.exam_slots(center_id,starts_at,ends_at,capacity)
         values(h.center_id,ts at time zone v_tz,(ts+make_interval(mins=>h.slot_minutes)) at time zone v_tz,h.capacity)
         on conflict(center_id,starts_at) do nothing;
         if found then v_count:=v_count+1; end if;
         ts:=ts+make_interval(mins=>h.slot_minutes);
       end loop;
     end if;
   end loop;
 end loop;
 return v_count;
end;$function$;

revoke all on function public.book_exam_appointment(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.book_exam_appointment(uuid,uuid,uuid,text) to authenticated;
revoke all on function public.generate_exam_slots(integer) from public,anon,authenticated;
grant execute on function public.generate_exam_slots(integer) to service_role;

commit;

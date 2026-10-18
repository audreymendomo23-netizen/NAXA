-- NAXA 112 — catalogue de prestations et demandes à domicile.
-- Adresse exacte stockée séparément : elle n'est lisible par le partenaire qu'après confirmation.
-- Additif : ne modifie ni les réservations historiques de Pharmacie ni les réservations multi-univers.
begin;

create table if not exists public.home_service_offers (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 180),
  category text not null default 'Autres' check (length(trim(category)) between 2 and 100),
  description text,
  service_area_label text not null check (length(trim(service_area_label)) between 2 and 180),
  price_fcfa integer check (price_fcfa is null or price_fcfa >= 0),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists home_service_offers_public_idx
  on public.home_service_offers(status,category,name);
create index if not exists home_service_offers_partner_idx
  on public.home_service_offers(partner_id,updated_at desc);

create table if not exists public.home_service_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete restrict,
  partner_id uuid not null references public.partners(id) on delete restrict,
  offer_id uuid not null references public.home_service_offers(id) on delete restrict,
  offer_name text not null,
  category text not null,
  price_fcfa integer check (price_fcfa is null or price_fcfa >= 0),
  service_area_label text not null,
  preferred_at timestamptz,
  client_note text,
  status text not null default 'requested'
    check (status in ('requested','confirmed','completed','cancelled','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  completed_at timestamptz
);
create index if not exists home_service_requests_client_idx
  on public.home_service_requests(client_id,created_at desc);
create index if not exists home_service_requests_partner_idx
  on public.home_service_requests(partner_id,status,created_at desc);

create table if not exists public.home_service_request_addresses (
  request_id uuid primary key references public.home_service_requests(id) on delete restrict,
  client_id uuid not null references auth.users(id) on delete restrict,
  exact_address text not null check (length(trim(exact_address)) between 5 and 500),
  contact_phone text not null check (length(trim(contact_phone)) between 7 and 40),
  created_at timestamptz not null default now()
);

alter table public.home_service_offers enable row level security;
alter table public.home_service_requests enable row level security;
alter table public.home_service_request_addresses enable row level security;

drop policy if exists home_service_offers_public_read on public.home_service_offers;
create policy home_service_offers_public_read on public.home_service_offers
for select to anon,authenticated using (
  status='active'
  and exists (
    select 1 from public.partners pa
    join public.partner_universes pu on pu.partner_id=pa.id and pu.universe_slug='prestations' and pu.enabled=true
    join public.universes u on u.slug='prestations' and u.enabled=true
    join public.feature_flags ff on ff.flag_key='universe.prestations' and ff.enabled=true
    where pa.id=home_service_offers.partner_id and pa.status='active'
  )
);
drop policy if exists home_service_offers_partner_manage on public.home_service_offers;
create policy home_service_offers_partner_manage on public.home_service_offers
for all to authenticated using (
  exists(select 1 from public.partner_members pm join public.partners pa on pa.id=pm.partner_id
    where pm.partner_id=home_service_offers.partner_id and pm.user_id=auth.uid()
      and pm.member_role in ('owner','manager','operator') and pa.status='active'
      and pa.partner_type='professionnel_domicile')
) with check (
  exists(select 1 from public.partner_members pm join public.partners pa on pa.id=pm.partner_id
    where pm.partner_id=home_service_offers.partner_id and pm.user_id=auth.uid()
      and pm.member_role in ('owner','manager','operator') and pa.status='active'
      and pa.partner_type='professionnel_domicile')
);
drop policy if exists home_service_offers_admin_manage on public.home_service_offers;
create policy home_service_offers_admin_manage on public.home_service_offers
for all to authenticated using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
) with check (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
);

drop policy if exists home_service_requests_client_read on public.home_service_requests;
create policy home_service_requests_client_read on public.home_service_requests
for select to authenticated using (client_id=auth.uid());
drop policy if exists home_service_requests_partner_read on public.home_service_requests;
create policy home_service_requests_partner_read on public.home_service_requests
for select to authenticated using (
  exists(select 1 from public.partner_members pm join public.partners pa on pa.id=pm.partner_id
    where pm.partner_id=home_service_requests.partner_id and pm.user_id=auth.uid()
      and pm.member_role in ('owner','manager','operator') and pa.status='active')
);
drop policy if exists home_service_requests_admin_read on public.home_service_requests;
create policy home_service_requests_admin_read on public.home_service_requests
for select to authenticated using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
);

drop policy if exists home_service_request_addresses_client_read on public.home_service_request_addresses;
create policy home_service_request_addresses_client_read on public.home_service_request_addresses
for select to authenticated using (client_id=auth.uid());
drop policy if exists home_service_request_addresses_confirmed_partner_read on public.home_service_request_addresses;
create policy home_service_request_addresses_confirmed_partner_read on public.home_service_request_addresses
for select to authenticated using (
  exists (
    select 1 from public.home_service_requests r
    join public.partner_members pm on pm.partner_id=r.partner_id
    join public.partners pa on pa.id=pm.partner_id and pa.status='active'
    where r.id=home_service_request_addresses.request_id
      and r.status in ('confirmed','completed')
      and pm.user_id=auth.uid()
      and pm.member_role in ('owner','manager','operator')
  )
);
-- Aucune politique d'écriture directe sur les demandes/adresses : les RPC ci-dessous valident les rôles.

create or replace function public.get_home_service_catalog()
returns table(
  offer_id uuid, partner_id uuid, partner_name text, city text, neighborhood text,
  name text, category text, description text, service_area_label text, price_fcfa integer
)
language sql stable security definer set search_path=public
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
revoke all on function public.get_home_service_catalog() from public;
grant execute on function public.get_home_service_catalog() to anon,authenticated;

create or replace function public.request_home_service(
  p_offer_id uuid,
  p_area_label text,
  p_exact_address text,
  p_contact_phone text,
  p_preferred_at timestamptz default null,
  p_client_note text default null
)
returns uuid language plpgsql security definer set search_path=public
as $function$
declare
  uid uuid:=auth.uid();
  offer_row public.home_service_offers%rowtype;
  partner_row public.partners%rowtype;
  request_id uuid;
begin
  if uid is null then raise exception 'Connexion requise' using errcode='28000'; end if;
  if not exists(select 1 from public.profiles p where p.id=uid and p.role='client') then
    raise exception 'Compte client requis' using errcode='42501';
  end if;
  if p_offer_id is null or length(trim(coalesce(p_area_label,''))) not between 2 and 180
    or length(trim(coalesce(p_exact_address,''))) not between 5 and 500
    or length(trim(coalesce(p_contact_phone,''))) not between 7 and 40
    or (p_preferred_at is not null and p_preferred_at<=now()) then
    raise exception 'Informations de demande invalides' using errcode='22023';
  end if;
  select * into offer_row from public.home_service_offers where id=p_offer_id and status='active';
  if not found then raise exception 'Prestation indisponible'; end if;
  select * into partner_row from public.partners where id=offer_row.partner_id and status='active' and partner_type='professionnel_domicile';
  if not found or not public.universe_partner_is_public(partner_row.id,'prestations') then
    raise exception 'Professionnel indisponible';
  end if;
  insert into public.home_service_requests(client_id,partner_id,offer_id,offer_name,category,price_fcfa,service_area_label,preferred_at,client_note)
  values(uid,partner_row.id,offer_row.id,offer_row.name,offer_row.category,offer_row.price_fcfa,
    left(trim(p_area_label),180),p_preferred_at,nullif(left(trim(coalesce(p_client_note,'')),500),''))
  returning id into request_id;
  insert into public.home_service_request_addresses(request_id,client_id,exact_address,contact_phone)
  values(request_id,uid,left(trim(p_exact_address),500),left(trim(p_contact_phone),40));
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(uid,'home_service.requested','home_service_request',request_id::text,
    jsonb_build_object('partner_id',partner_row.id,'offer_id',offer_row.id,'area_label',left(trim(p_area_label),180)));
  return request_id;
end;
$function$;
revoke all on function public.request_home_service(uuid,text,text,text,timestamptz,text) from public,anon;
grant execute on function public.request_home_service(uuid,text,text,text,timestamptz,text) to authenticated;

create or replace function public.get_home_service_request_receipt(p_request_id uuid)
returns table(
  request_id uuid,status text,offer_name text,category text,price_fcfa integer,
  partner_name text,service_area_label text,preferred_at timestamptz,created_at timestamptz,
  exact_address text,contact_phone text,client_note text
)
language plpgsql stable security definer set search_path=public
as $function$
declare uid uuid:=auth.uid(); r public.home_service_requests%rowtype;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select * into r from public.home_service_requests where id=p_request_id;
  if not found then raise exception 'Demande introuvable'; end if;
  if r.client_id<>uid and not exists(select 1 from public.profiles p where p.id=uid and p.role='admin') then
    raise exception 'Accès refusé' using errcode='42501';
  end if;
  return query
  select r.id,r.status,r.offer_name,r.category,r.price_fcfa,p.name,r.service_area_label,r.preferred_at,r.created_at,
    a.exact_address,a.contact_phone,r.client_note
  from public.partners p
  left join public.home_service_request_addresses a on a.request_id=r.id
  where p.id=r.partner_id;
end;
$function$;
revoke all on function public.get_home_service_request_receipt(uuid) from public,anon;
grant execute on function public.get_home_service_request_receipt(uuid) to authenticated;

create or replace function public.transition_home_service_request(p_request_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public
as $function$
declare uid uuid:=auth.uid(); r public.home_service_requests%rowtype; is_admin boolean; can_manage boolean;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select * into r from public.home_service_requests where id=p_request_id for update;
  if not found then raise exception 'Demande introuvable'; end if;
  select exists(select 1 from public.profiles p where p.id=uid and p.role='admin') into is_admin;
  select exists(select 1 from public.partner_members pm join public.partners pa on pa.id=pm.partner_id
    where pm.partner_id=r.partner_id and pm.user_id=uid and pm.member_role in ('owner','manager','operator') and pa.status='active') into can_manage;

  if p_status='cancelled' and r.client_id=uid and r.status in ('requested','confirmed') then
    update public.home_service_requests set status='cancelled',updated_at=now() where id=r.id;
    insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(uid,'home_service.cancelled','home_service_request',r.id::text,'{"by":"client"}'::jsonb);
    return;
  end if;
  if not (is_admin or can_manage) then raise exception 'Action non autorisée' using errcode='42501'; end if;
  if r.status in ('completed','cancelled','expired') then raise exception 'Demande déjà clôturée'; end if;
  if p_status='confirmed' and r.status='requested' then
    update public.home_service_requests set status='confirmed',confirmed_at=now(),updated_at=now() where id=r.id;
  elsif p_status='completed' and r.status='confirmed' then
    update public.home_service_requests set status='completed',completed_at=now(),updated_at=now() where id=r.id;
  else
    raise exception 'Transition de statut non autorisée';
  end if;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(uid,'home_service.'||p_status,'home_service_request',r.id::text,jsonb_build_object('partner_id',r.partner_id));
end;
$function$;
revoke all on function public.transition_home_service_request(uuid,text) from public,anon;
grant execute on function public.transition_home_service_request(uuid,text) to authenticated;

create or replace function public.admin_set_home_service_offer_status(p_offer_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public
as $function$
declare uid uuid:=auth.uid(); offer_row public.home_service_offers%rowtype;
begin
  if uid is null or not exists(select 1 from public.profiles p where p.id=uid and p.role='admin') then
    raise exception 'Action réservée à l’administration' using errcode='42501';
  end if;
  if p_status not in ('draft','active','archived') then raise exception 'Statut invalide'; end if;
  select * into offer_row from public.home_service_offers where id=p_offer_id for update;
  if not found then raise exception 'Prestation introuvable'; end if;
  if p_status='active' and not exists(
    select 1 from public.partners p
    join public.partner_universes pu on pu.partner_id=p.id and pu.universe_slug='prestations' and pu.enabled=true
    join public.universes u on u.slug='prestations' and u.enabled=true
    join public.feature_flags ff on ff.flag_key='universe.prestations' and ff.enabled=true
    where p.id=offer_row.partner_id and p.status='active' and p.partner_type='professionnel_domicile'
  ) then raise exception 'Le partenaire et l’univers doivent être actifs'; end if;
  update public.home_service_offers set status=p_status,updated_at=now() where id=p_offer_id;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(uid,'home_service.offer_status','home_service_offer',p_offer_id::text,jsonb_build_object('status',p_status));
end;
$function$;
revoke all on function public.admin_set_home_service_offer_status(uuid,text) from public,anon;
grant execute on function public.admin_set_home_service_offer_status(uuid,text) to authenticated;

-- Explicit table grants: no direct client writes to requests or private addresses.
revoke all on public.home_service_offers, public.home_service_requests, public.home_service_request_addresses from public, anon;
revoke all on public.home_service_offers, public.home_service_requests, public.home_service_request_addresses from authenticated;
grant select,insert,update on public.home_service_offers to authenticated;
grant select on public.home_service_requests, public.home_service_request_addresses to authenticated;

commit;

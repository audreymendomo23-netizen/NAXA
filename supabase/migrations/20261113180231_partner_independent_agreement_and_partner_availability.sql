-- NAXA — Partenaire indépendant Prestations et soins à domicile.
-- Le suivi connecté est un canal d'entrée, pas une catégorie professionnelle distincte.
-- L'accréditation médicale et l'appartenance comme salarié ne remplacent pas la convention autonome.
begin;

create table if not exists public.partner_independent_agreement_templates (
  id uuid primary key default gen_random_uuid(),
  partner_type text not null default 'professionnel_domicile'
    check (partner_type='professionnel_domicile'),
  version text not null unique check (length(trim(version)) between 3 and 80),
  title text not null check (length(trim(title)) between 3 and 180),
  body text not null check (length(trim(body)) >= 100),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_independent_template_publish_ck check (
    (status='published' and published_by is not null and published_at is not null)
    or status<>'published'
  )
);

create unique index if not exists partner_independent_agreement_one_published_idx
  on public.partner_independent_agreement_templates(partner_type)
  where status='published';

alter table public.partner_independent_agreement_templates enable row level security;
revoke all on public.partner_independent_agreement_templates from public,anon,authenticated;
grant select on public.partner_independent_agreement_templates to authenticated;

drop policy if exists partner_independent_templates_published_read on public.partner_independent_agreement_templates;
create policy partner_independent_templates_published_read
  on public.partner_independent_agreement_templates for select to authenticated
  using (status='published');

drop policy if exists partner_independent_templates_admin_manage on public.partner_independent_agreement_templates;
create policy partner_independent_templates_admin_manage
  on public.partner_independent_agreement_templates for all to authenticated
  using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin' and p.actif=true))
  with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin' and p.actif=true));

create table if not exists public.partner_independent_agreements (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  professional_user_id uuid not null references public.profiles(id) on delete restrict,
  template_id uuid not null references public.partner_independent_agreement_templates(id) on delete restrict,
  agreement_version text not null,
  agreement_sha256 text not null check (agreement_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending_review'
    check (status in ('pending_review','active','rejected','revoked','expired')),
  accepted_at timestamptz not null,
  accepted_by uuid not null references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete restrict,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete restrict,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_independent_agreement_acceptor_ck check (accepted_by=professional_user_id),
  constraint partner_independent_agreement_approval_ck check (
    (status='active' and approved_at is not null and approved_by is not null and revoked_at is null and revoked_by is null)
    or (status<>'active' and (approved_at is null or approved_by is not null))
  ),
  constraint partner_independent_agreement_revocation_ck check (
    (status='revoked' and revoked_at is not null and revoked_by is not null)
    or (status<>'revoked' and revoked_at is null and revoked_by is null)
  ),
  constraint partner_independent_agreement_expiry_ck check (expires_at is null or approved_at is not null)
);

create unique index if not exists partner_independent_agreement_one_open_idx
  on public.partner_independent_agreements(partner_id)
  where status in ('pending_review','active');

create index if not exists partner_independent_agreement_owner_status_idx
  on public.partner_independent_agreements(professional_user_id,status,created_at desc);

create index if not exists partner_independent_agreement_partner_status_idx
  on public.partner_independent_agreements(partner_id,status,created_at desc);

alter table public.partner_independent_agreements enable row level security;
revoke all on public.partner_independent_agreements from public,anon,authenticated;
grant select on public.partner_independent_agreements to authenticated;

drop policy if exists partner_independent_agreements_owner_or_admin_read on public.partner_independent_agreements;
create policy partner_independent_agreements_owner_or_admin_read
  on public.partner_independent_agreements for select to authenticated
  using (
    professional_user_id=(select auth.uid())
    or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin' and p.actif=true)
  );

create or replace function private.naxa_partner_has_active_independent_agreement(
  p_partner_id uuid,
  p_user_id uuid
) returns boolean
language sql stable security definer set search_path=''
as $function$
  select coalesce(
    p_partner_id is not null and p_user_id is not null
    and exists (
      select 1
      from public.partner_independent_agreements a
      join public.partners pa on pa.id=a.partner_id
      join public.partner_members pm
        on pm.partner_id=pa.id
       and pm.user_id=a.professional_user_id
       and pm.member_role='owner'
      join public.profiles owner_profile
        on owner_profile.id=a.professional_user_id and owner_profile.actif=true
      where a.partner_id=p_partner_id
        and a.professional_user_id=p_user_id
        and a.status='active'
        and a.accepted_at is not null
        and a.accepted_by=a.professional_user_id
        and a.approved_at is not null
        and (a.expires_at is null or a.expires_at>now())
        and pa.status='active'
        and pa.partner_type='professionnel_domicile'
    ),
    false
  );
$function$;

revoke all on function private.naxa_partner_has_active_independent_agreement(uuid,uuid) from public,anon,authenticated;

create or replace function public.partner_has_active_independent_agreement(p_partner_id uuid)
returns boolean
language sql stable security definer set search_path=''
as $function$
  select coalesce(
    auth.uid() is not null
    and private.naxa_partner_has_active_independent_agreement(p_partner_id,auth.uid()),
    false
  );
$function$;
revoke all on function public.partner_has_active_independent_agreement(uuid) from public,anon;
grant execute on function public.partner_has_active_independent_agreement(uuid) to authenticated;

create or replace function public.partner_independent_agreement_accept(p_partner_id uuid)
returns uuid
language plpgsql security definer set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_template public.partner_independent_agreement_templates%rowtype;
  v_agreement_id uuid;
begin
  if v_user is null then raise exception 'Connexion requise' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user and p.actif=true) then
    raise exception 'Compte actif requis' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.partners pa
    join public.partner_members pm on pm.partner_id=pa.id
    where pa.id=p_partner_id and pa.partner_type='professionnel_domicile'
      and pa.status='active' and pm.user_id=v_user and pm.member_role='owner'
  ) then
    raise exception 'Seul le titulaire du Partenaire indépendant actif peut accepter la convention' using errcode='42501';
  end if;
  select * into v_template
  from public.partner_independent_agreement_templates
  where partner_type='professionnel_domicile' and status='published'
  order by published_at desc limit 1;
  if not found then
    raise exception 'Aucune convention NAXA publiée pour les Partenaires Prestations et soins à domicile' using errcode='55000';
  end if;
  if exists(
    select 1 from public.partner_independent_agreements a
    where a.partner_id=p_partner_id and a.status in ('pending_review','active')
  ) then
    raise exception 'Une convention est déjà en attente ou active pour ce Partenaire' using errcode='23505';
  end if;

  insert into public.partner_independent_agreements(
    partner_id,professional_user_id,template_id,agreement_version,agreement_sha256,
    status,accepted_at,accepted_by
  ) values (
    p_partner_id,v_user,v_template.id,v_template.version,v_template.sha256,
    'pending_review',now(),v_user
  ) returning id into v_agreement_id;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_user,'partner.independent_agreement_accepted','partner_independent_agreement',v_agreement_id::text,
    jsonb_build_object('partner_id',p_partner_id,'template_version',v_template.version,'sha256',v_template.sha256));

  return v_agreement_id;
end;
$function$;
revoke all on function public.partner_independent_agreement_accept(uuid) from public,anon;
grant execute on function public.partner_independent_agreement_accept(uuid) to authenticated;

create or replace function public.admin_review_partner_independent_agreement(
  p_agreement_id uuid,
  p_approve boolean,
  p_expires_at timestamptz default null,
  p_reason text default null
) returns void
language plpgsql security definer set search_path=''
as $function$
declare
  v_admin uuid:=auth.uid();
  v_agreement public.partner_independent_agreements%rowtype;
begin
  if v_admin is null or not exists(
    select 1 from public.profiles p where p.id=v_admin and p.role='admin' and p.actif=true
  ) then raise exception 'Accès administrateur actif requis' using errcode='42501'; end if;

  select * into v_agreement from public.partner_independent_agreements
  where id=p_agreement_id and status='pending_review' for update;
  if not found then raise exception 'Convention en attente introuvable'; end if;

  if p_approve then
    if p_expires_at is not null and p_expires_at<=now() then
      raise exception 'La date d’expiration doit être future' using errcode='22023';
    end if;
    if not exists(
      select 1 from public.partners pa
      join public.partner_members pm on pm.partner_id=pa.id
      join public.profiles owner_profile on owner_profile.id=pm.user_id and owner_profile.actif=true
      where pa.id=v_agreement.partner_id and pa.status='active'
        and pa.partner_type='professionnel_domicile'
        and pm.user_id=v_agreement.professional_user_id and pm.member_role='owner'
    ) then raise exception 'Le Partenaire et son titulaire doivent être actifs'; end if;

    update public.partner_independent_agreements
    set status='active',approved_at=now(),approved_by=v_admin,expires_at=p_expires_at,
        decision_reason=nullif(trim(coalesce(p_reason,'')),''),
        updated_at=now()
    where id=p_agreement_id;
  else
    if length(trim(coalesce(p_reason,'')))<5 then
      raise exception 'Un motif de refus de 5 caractères minimum est obligatoire' using errcode='22023';
    end if;
    update public.partner_independent_agreements
    set status='rejected',approved_at=null,approved_by=v_admin,expires_at=null,
        decision_reason=trim(p_reason),updated_at=now()
    where id=p_agreement_id;
  end if;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_admin,case when p_approve then 'partner.independent_agreement_approved' else 'partner.independent_agreement_rejected' end,
    'partner_independent_agreement',p_agreement_id::text,
    jsonb_build_object('partner_id',v_agreement.partner_id,'professional_user_id',v_agreement.professional_user_id,
      'expires_at',case when p_approve then p_expires_at else null end,'reason',nullif(trim(coalesce(p_reason,'')) ,'')));
end;
$function$;
revoke all on function public.admin_review_partner_independent_agreement(uuid,boolean,timestamptz,text) from public,anon;
grant execute on function public.admin_review_partner_independent_agreement(uuid,boolean,timestamptz,text) to authenticated;

create or replace function public.partner_independent_agreement_revoke(
  p_agreement_id uuid,
  p_reason text
) returns void
language plpgsql security definer set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_agreement public.partner_independent_agreements%rowtype;
  v_admin boolean;
begin
  if v_user is null then raise exception 'Connexion requise' using errcode='42501'; end if;
  select exists(select 1 from public.profiles p where p.id=v_user and p.role='admin' and p.actif=true) into v_admin;
  select * into v_agreement from public.partner_independent_agreements
  where id=p_agreement_id and status in ('active','pending_review') for update;
  if not found then raise exception 'Convention active ou en attente introuvable'; end if;
  if not v_admin and v_agreement.professional_user_id<>v_user then
    raise exception 'Seul le titulaire de la convention ou un Admin actif peut la révoquer' using errcode='42501';
  end if;
  if length(trim(coalesce(p_reason,'')))<5 then
    raise exception 'Motif de révocation de 5 caractères minimum obligatoire' using errcode='22023';
  end if;

  update public.partner_independent_agreements
  set status='revoked',revoked_at=now(),revoked_by=v_user,decision_reason=trim(p_reason),updated_at=now()
  where id=p_agreement_id;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_user,'partner.independent_agreement_revoked','partner_independent_agreement',p_agreement_id::text,
    jsonb_build_object('partner_id',v_agreement.partner_id,'professional_user_id',v_agreement.professional_user_id,'reason',trim(p_reason)));
end;
$function$;
revoke all on function public.partner_independent_agreement_revoke(uuid,text) from public,anon;
grant execute on function public.partner_independent_agreement_revoke(uuid,text) to authenticated;

create table if not exists public.partner_weekly_availability (
  partner_id uuid not null references public.partners(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  is_open boolean not null default false,
  opens_at time without time zone,
  closes_at time without time zone,
  timezone text not null default 'Africa/Douala' check (timezone='Africa/Douala'),
  updated_at timestamptz not null default now(),
  primary key(partner_id,weekday),
  constraint partner_weekly_availability_hours_check check (
    (is_open=true and opens_at is not null and closes_at is not null and opens_at<closes_at)
    or (is_open=false and opens_at is null and closes_at is null)
  )
);

create index if not exists partner_weekly_availability_day_idx
  on public.partner_weekly_availability(weekday,is_open,partner_id);

alter table public.partner_weekly_availability enable row level security;
revoke all on public.partner_weekly_availability from public,anon,authenticated;
grant select,insert,update,delete on public.partner_weekly_availability to authenticated;

drop policy if exists partner_weekly_availability_owner_read on public.partner_weekly_availability;
create policy partner_weekly_availability_owner_read
  on public.partner_weekly_availability for select to authenticated
  using (public.partner_has_active_independent_agreement(partner_id)
    or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin' and p.actif=true));

drop policy if exists partner_weekly_availability_owner_insert on public.partner_weekly_availability;
create policy partner_weekly_availability_owner_insert
  on public.partner_weekly_availability for insert to authenticated
  with check (public.partner_has_active_independent_agreement(partner_id));

drop policy if exists partner_weekly_availability_owner_update on public.partner_weekly_availability;
create policy partner_weekly_availability_owner_update
  on public.partner_weekly_availability for update to authenticated
  using (public.partner_has_active_independent_agreement(partner_id))
  with check (public.partner_has_active_independent_agreement(partner_id));

drop policy if exists partner_weekly_availability_owner_delete on public.partner_weekly_availability;
create policy partner_weekly_availability_owner_delete
  on public.partner_weekly_availability for delete to authenticated
  using (public.partner_has_active_independent_agreement(partner_id));

-- Keep existing personal schedules for traceability; they are no longer public availability sources.
revoke insert,update,delete on public.suivi_professional_weekly_availability from authenticated;
drop policy if exists suivi_professional_weekly_availability_self_insert on public.suivi_professional_weekly_availability;
drop policy if exists suivi_professional_weekly_availability_self_update on public.suivi_professional_weekly_availability;
drop policy if exists suivi_professional_weekly_availability_self_delete on public.suivi_professional_weekly_availability;

create or replace function private.suivi_is_verified_professional(p_user_id uuid)
returns boolean
language sql stable security definer set search_path=''
as $function$
  select coalesce(
    p_user_id is not null
    and exists(
      select 1
      from public.suivi_professionals sp
      where sp.user_id=p_user_id
        and sp.verified is true
        and sp.verification_status='verified'
        and (sp.verification_expires_at is null or sp.verification_expires_at>now())
    )
    and exists(
      select 1 from public.partner_independent_agreements a
      join public.partners pa on pa.id=a.partner_id
      join public.partner_members pm on pm.partner_id=pa.id and pm.user_id=a.professional_user_id and pm.member_role='owner'
      join public.profiles owner_profile on owner_profile.id=a.professional_user_id and owner_profile.actif=true
      where a.professional_user_id=p_user_id and a.status='active'
        and a.accepted_at is not null and a.accepted_by=p_user_id
        and a.approved_at is not null and (a.expires_at is null or a.expires_at>now())
        and pa.status='active' and pa.partner_type='professionnel_domicile'
    ),
    false
  );
$function$;
revoke all on function private.suivi_is_verified_professional(uuid) from public,anon,authenticated;

create or replace function public.suivi_list_verified_professional_directory()
returns table(user_id uuid,professional_role text,display_name text,specialty text)
language sql stable security definer set search_path=''
as $function$
  select sp.user_id,sp.professional_role,sp.display_name,sp.specialty
  from public.suivi_professionals sp
  join public.profiles account on account.id=sp.user_id and account.actif=true
  join public.partner_independent_agreements a on a.professional_user_id=sp.user_id and a.status='active'
  join public.partners pa on pa.id=a.partner_id and pa.status='active' and pa.partner_type='professionnel_domicile'
  join public.partner_members pm on pm.partner_id=pa.id and pm.user_id=sp.user_id and pm.member_role='owner'
  where sp.verified is true
    and sp.verification_status='verified'
    and (sp.verification_expires_at is null or sp.verification_expires_at>now())
    and a.accepted_at is not null and a.accepted_by=sp.user_id
    and a.approved_at is not null and (a.expires_at is null or a.expires_at>now())
    and exists(select 1 from public.feature_flags f where f.flag_key='suivi_connecte' and f.enabled=true)
    and exists(select 1 from public.profiles patient where patient.id=(select auth.uid()) and patient.actif=true)
  order by sp.professional_role,sp.display_name;
$function$;
revoke all on function public.suivi_list_verified_professional_directory() from public,anon;
grant execute on function public.suivi_list_verified_professional_directory() to authenticated;

create or replace function public.suivi_list_independent_partner_directory()
returns table(
  user_id uuid,partner_id uuid,professional_role text,display_name text,specialty text,
  partner_name text,city text,neighborhood text,latitude numeric,longitude numeric,
  available_today boolean,available_now boolean,
  today_opens_at time without time zone,today_closes_at time without time zone
)
language sql stable security definer set search_path=''
as $function$
  select
    sp.user_id,pa.id,sp.professional_role,sp.display_name,sp.specialty,
    pa.name,pa.city,pa.neighborhood,coalesce(pa.provider_latitude,pa.latitude),
    coalesce(pa.provider_longitude,pa.longitude),
    coalesce(av.is_open and timezone('Africa/Douala',now())::time<av.closes_at,false),
    coalesce(av.is_open
      and timezone('Africa/Douala',now())::time>=av.opens_at
      and timezone('Africa/Douala',now())::time<av.closes_at,false),
    case when av.is_open then av.opens_at else null end,
    case when av.is_open then av.closes_at else null end
  from public.suivi_professionals sp
  join public.profiles owner_profile on owner_profile.id=sp.user_id and owner_profile.actif=true
  join public.partner_independent_agreements a
    on a.professional_user_id=sp.user_id and a.status='active'
  join public.partners pa
    on pa.id=a.partner_id and pa.status='active' and pa.partner_type='professionnel_domicile'
  join public.partner_members pm
    on pm.partner_id=pa.id and pm.user_id=sp.user_id and pm.member_role='owner'
  left join public.partner_weekly_availability av
    on av.partner_id=pa.id
   and av.weekday=extract(isodow from timezone('Africa/Douala',now()))::smallint
  where sp.verified is true
    and sp.verification_status='verified'
    and (sp.verification_expires_at is null or sp.verification_expires_at>now())
    and a.accepted_at is not null and a.accepted_by=sp.user_id
    and a.approved_at is not null
    and (a.expires_at is null or a.expires_at>now())
    and exists(select 1 from public.feature_flags f where f.flag_key='suivi_connecte' and f.enabled=true)
    and exists(select 1 from public.profiles requester where requester.id=(select auth.uid()) and requester.actif=true)
  order by pa.name,sp.display_name;
$function$;
revoke all on function public.suivi_list_independent_partner_directory() from public,anon;
grant execute on function public.suivi_list_independent_partner_directory() to authenticated;

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
    coalesce(nullif(trim(sp.specialty),''),nullif(trim(o.category),'')),
    coalesce(av.is_open and timezone('Africa/Douala',now())::time<av.closes_at,false),
    coalesce(av.is_open
      and timezone('Africa/Douala',now())::time>=av.opens_at
      and timezone('Africa/Douala',now())::time<av.closes_at,false),
    case when av.is_open then av.opens_at else null end,
    case when av.is_open then av.closes_at else null end
  from public.home_service_offers o
  join public.partners p on p.id=o.partner_id and p.status='active' and p.partner_type='professionnel_domicile'
  join public.partner_independent_agreements a
    on a.partner_id=p.id and a.status='active'
   and a.accepted_at is not null and a.approved_at is not null
   and (a.expires_at is null or a.expires_at>now())
  join public.partner_universes pu on pu.partner_id=p.id and pu.universe_slug='prestations' and pu.enabled=true
  join public.universes u on u.slug='prestations' and u.enabled=true
  join public.feature_flags ff on ff.flag_key='universe.prestations' and ff.enabled=true
  left join public.suivi_professionals sp
    on sp.user_id=a.professional_user_id
   and sp.verified is true and sp.verification_status='verified'
   and (sp.verification_expires_at is null or sp.verification_expires_at>now())
  left join public.partner_weekly_availability av
    on av.partner_id=p.id
   and av.weekday=extract(isodow from timezone('Africa/Douala',now()))::smallint
  where o.status='active'
  order by o.category,o.name,p.name;
$function$;

revoke all on function private.get_home_service_catalog_for_client() from public,anon,authenticated;
grant execute on function private.get_home_service_catalog_for_client() to anon,authenticated,service_role;

create or replace function public.set_professional_partner_location(
  p_partner_id uuid,
  p_user_id uuid,
  p_latitude numeric,
  p_longitude numeric
)
returns void
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_reset boolean;
begin
  if p_partner_id is null or p_user_id is null or p_user_id is distinct from auth.uid() then
    raise exception 'Identité professionnelle invalide' using errcode='42501';
  end if;
  if not private.naxa_partner_has_active_independent_agreement(p_partner_id,p_user_id) then
    raise exception 'Convention indépendante NAXA active requise pour modifier la position du Partenaire' using errcode='42501';
  end if;
  if ((p_latitude is null) <> (p_longitude is null))
    or (p_latitude is not null and (p_latitude not between -90 and 90 or p_longitude not between -180 and 180)) then
    raise exception 'Coordonnées GPS invalides' using errcode='22023';
  end if;
  v_reset:=p_latitude is null;
  update public.partners
  set provider_latitude=p_latitude,
      provider_longitude=p_longitude,
      provider_location_updated_at=case when v_reset then null else now() end,
      provider_location_updated_by=case when v_reset then null else p_user_id end,
      updated_at=now()
  where id=p_partner_id and status='active' and partner_type='professionnel_domicile';
  if not found then raise exception 'Position du Partenaire indépendant non enregistrée'; end if;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(p_user_id,case when v_reset then 'partner.provider_location_reset' else 'partner.provider_location_updated' end,
    'partner',p_partner_id::text,
    jsonb_build_object('latitude',p_latitude,'longitude',p_longitude,'source','independent_partner','uses_admin_fallback',v_reset));
end;
$function$;

revoke all on function public.set_professional_partner_location(uuid,uuid,numeric,numeric) from public,anon,authenticated;
grant execute on function public.set_professional_partner_location(uuid,uuid,numeric,numeric) to service_role;

commit;

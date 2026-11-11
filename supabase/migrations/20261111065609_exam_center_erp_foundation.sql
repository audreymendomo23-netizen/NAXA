-- NAXA — socle ERP autonome des centres d'examens.
-- Migration additive. Aucune table Pharmacie n'est réutilisée pour les centres.
begin;

-- Un même partenaire peut exploiter plusieurs centres.
alter table public.exam_centers drop constraint if exists exam_centers_partner_id_key;
create index if not exists exam_centers_partner_idx on public.exam_centers(partner_id);

alter table public.exam_centers
  add column if not exists city text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='exam_centers_latitude_range') then
    alter table public.exam_centers add constraint exam_centers_latitude_range
      check (latitude is null or latitude between -90 and 90);
  end if;
  if not exists (select 1 from pg_constraint where conname='exam_centers_longitude_range') then
    alter table public.exam_centers add constraint exam_centers_longitude_range
      check (longitude is null or longitude between -180 and 180);
  end if;
end $$;

create table if not exists public.exam_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.exam_centers(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role_key text not null check (role_key in (
    'directeur','accueil','caissier','comptable','technicien_laboratoire',
    'biologiste','manipulateur_imagerie','radiologue','responsable_qualite','responsable_securite'
  )),
  is_active boolean not null default true,
  active_role boolean not null default false,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(center_id,user_id,role_key),
  check ((is_active and revoked_at is null) or (not is_active and revoked_at is not null))
);
create index if not exists exam_staff_center_active_idx
  on public.exam_staff_assignments(center_id,is_active,role_key);
create index if not exists exam_staff_user_active_idx
  on public.exam_staff_assignments(user_id,is_active,active_role);
create unique index if not exists exam_staff_one_active_role_per_center
  on public.exam_staff_assignments(center_id,user_id)
  where is_active and active_role and revoked_at is null;

create schema if not exists private;

create or replace function private.exam_has_capability(p_center_id uuid,p_capability text)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.exam_staff_assignments a
      join public.profiles p on p.id=a.user_id
      where a.center_id=p_center_id
        and a.user_id=auth.uid()
        and a.is_active is true
        and a.active_role is true
        and a.revoked_at is null
        and p.actif is true
        and case a.role_key
          when 'directeur' then p_capability = any(array[
            'center_manage','appointments_read','appointments_manage','staff_manage',
            'security_read','security_manage','incident_report','equipment_read','equipment_manage',
            'finance_read','finance_write','finance_approve','communications_read','communications_write',
            'ai_use','result_metadata_read','quality_manage'
          ])
          when 'accueil' then p_capability = any(array[
            'appointments_read','appointments_manage','incident_report','communications_read',
            'communications_write','ai_use','result_metadata_read'
          ])
          when 'caissier' then p_capability = any(array[
            'appointments_read','incident_report','equipment_read','finance_read','finance_write',
            'communications_read','communications_write','ai_use','result_metadata_read'
          ])
          when 'comptable' then p_capability = any(array[
            'appointments_read','incident_report','finance_read','finance_write','finance_approve',
            'communications_read','ai_use','result_metadata_read'
          ])
          when 'technicien_laboratoire' then p_capability = any(array[
            'appointments_read','incident_report','equipment_read','equipment_manage',
            'results_draft','result_metadata_read','communications_read'
          ])
          when 'biologiste' then p_capability = any(array[
            'appointments_read','incident_report','equipment_read','equipment_manage',
            'results_draft','results_read','results_validate','results_publish',
            'result_files_read','result_metadata_read','communications_read'
          ])
          when 'manipulateur_imagerie' then p_capability = any(array[
            'appointments_read','incident_report','equipment_read','equipment_manage',
            'results_draft','result_metadata_read','communications_read'
          ])
          when 'radiologue' then p_capability = any(array[
            'appointments_read','incident_report','equipment_read','equipment_manage',
            'results_draft','results_read','results_validate','results_publish',
            'result_files_read','result_metadata_read','communications_read'
          ])
          when 'responsable_qualite' then p_capability = any(array[
            'appointments_read','incident_report','security_read','security_manage',
            'equipment_read','equipment_manage','quality_manage','result_metadata_read',
            'communications_read','ai_use'
          ])
          when 'responsable_securite' then p_capability = any(array[
            'incident_report','security_read','security_manage','staff_read','communications_read','ai_use'
          ])
          else false
        end
    );
$function$;

grant usage on schema private to authenticated;
revoke all on function private.exam_has_capability(uuid,text) from public,anon;
grant execute on function private.exam_has_capability(uuid,text) to authenticated;

-- Les propriétaires/gestionnaires de l'établissement deviennent directeurs du centre.
create or replace function private.exam_sync_partner_directors()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  insert into public.exam_staff_assignments(center_id,user_id,role_key,is_active,active_role,assigned_by)
  select new.id,pm.user_id,'directeur',true,
    not exists(select 1 from public.exam_staff_assignments x where x.center_id=new.id and x.user_id=pm.user_id and x.is_active and x.active_role and x.revoked_at is null),pm.user_id
  from public.partner_members pm
  join public.profiles p on p.id=pm.user_id and p.actif is true
  where pm.partner_id=new.partner_id
    and pm.member_role in ('owner','manager')
  on conflict(center_id,user_id,role_key) do nothing;
  return new;
end;
$function$;

drop trigger if exists exam_centers_sync_partner_directors on public.exam_centers;
create trigger exam_centers_sync_partner_directors
after insert on public.exam_centers
for each row execute function private.exam_sync_partner_directors();

create or replace function private.exam_sync_new_partner_director()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if tg_op='DELETE' then
    update public.exam_staff_assignments set is_active=false,active_role=false,revoked_at=now(),updated_at=now()
    where role_key='directeur' and user_id=old.user_id and center_id in (select id from public.exam_centers where partner_id=old.partner_id)
      and is_active;
    return old;
  end if;
  if new.member_role in ('owner','manager') then
    insert into public.exam_staff_assignments(center_id,user_id,role_key,is_active,active_role,assigned_by)
    select c.id,new.user_id,'directeur',true,
      not exists(select 1 from public.exam_staff_assignments x where x.center_id=c.id and x.user_id=new.user_id and x.is_active and x.active_role and x.revoked_at is null),new.user_id
    from public.exam_centers c
    join public.profiles p on p.id=new.user_id and p.actif is true
    where c.partner_id=new.partner_id
    on conflict(center_id,user_id,role_key) do nothing;
  else
    update public.exam_staff_assignments set is_active=false,active_role=false,revoked_at=now(),updated_at=now()
    where role_key='directeur' and user_id=new.user_id and center_id in (select id from public.exam_centers where partner_id=new.partner_id)
      and is_active;
  end if;
  return new;
end;
$function$;

drop trigger if exists partner_members_exam_director_sync on public.partner_members;
create trigger partner_members_exam_director_sync
after insert or update of member_role or delete on public.partner_members
for each row execute function private.exam_sync_new_partner_director();

-- Reprise des responsables déjà présents pour les centres existants.
insert into public.exam_staff_assignments(center_id,user_id,role_key,is_active,active_role,assigned_by)
select c.id,pm.user_id,'directeur',true,
  not exists(select 1 from public.exam_staff_assignments x where x.center_id=c.id and x.user_id=pm.user_id and x.is_active and x.active_role and x.revoked_at is null),pm.user_id
from public.exam_centers c
join public.partner_members pm on pm.partner_id=c.partner_id and pm.member_role in ('owner','manager')
join public.profiles p on p.id=pm.user_id and p.actif is true
on conflict(center_id,user_id,role_key) do nothing;

create or replace function private.exam_guard_staff_assignment_update()
returns trigger
language plpgsql
set search_path=''
as $function$
begin
  if auth.uid() is not null and old.user_id=auth.uid() then
    if new.user_id is distinct from old.user_id
      or new.center_id is distinct from old.center_id
      or new.role_key is distinct from old.role_key
      or new.is_active is distinct from old.is_active
      or new.revoked_at is distinct from old.revoked_at
      or new.assigned_by is distinct from old.assigned_by
      or new.note is distinct from old.note then
      raise exception 'Un membre ne peut modifier que son rôle actif' using errcode='42501';
    end if;
  elsif not private.exam_has_capability(old.center_id,'staff_manage') then
    raise exception 'Gestion du personnel du centre requise' using errcode='42501';
  end if;
  new.updated_at:=now();
  return new;
end;
$function$;

drop trigger if exists exam_staff_assignment_guard on public.exam_staff_assignments;
create trigger exam_staff_assignment_guard
before update on public.exam_staff_assignments
for each row execute function private.exam_guard_staff_assignment_update();

create or replace function public.exam_set_active_role(p_center_id uuid,p_assignment_id uuid)
returns boolean
language plpgsql
security invoker
set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_count integer;
begin
  if v_user is null then raise exception 'Connexion requise' using errcode='28000'; end if;
  if not exists (
    select 1 from public.exam_staff_assignments a
    join public.profiles p on p.id=a.user_id
    where a.id=p_assignment_id and a.center_id=p_center_id and a.user_id=v_user
      and a.is_active and a.revoked_at is null and p.actif is true
  ) then raise exception 'Affectation active introuvable' using errcode='42501'; end if;
  update public.exam_staff_assignments set active_role=false
    where center_id=p_center_id and user_id=v_user and is_active and revoked_at is null and active_role;
  update public.exam_staff_assignments set active_role=true
    where id=p_assignment_id and center_id=p_center_id and user_id=v_user and is_active and revoked_at is null;
  get diagnostics v_count=row_count;
  if v_count<>1 then raise exception 'Activation du rôle impossible' using errcode='23514'; end if;
  return true;
end;
$function$;
revoke all on function public.exam_set_active_role(uuid,uuid) from public,anon;
grant execute on function public.exam_set_active_role(uuid,uuid) to authenticated;

create table if not exists public.exam_results (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.exam_centers(id) on delete restrict,
  appointment_id uuid not null unique references public.exam_appointments(id) on delete restrict,
  client_id uuid not null references auth.users(id) on delete restrict,
  title text not null check(length(trim(title)) between 2 and 180),
  status text not null default 'draft' check(status in ('draft','validated','published','withdrawn')),
  drafted_by uuid references auth.users(id) on delete set null,
  validated_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists exam_results_center_status_idx on public.exam_results(center_id,status,created_at desc);
create index if not exists exam_results_client_idx on public.exam_results(client_id,status,created_at desc);

create table if not exists public.exam_result_contents (
  result_id uuid primary key references public.exam_results(id) on delete restrict,
  report_text text not null,
  conclusion text,
  methodology text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check(length(report_text) between 1 and 50000)
);

create table if not exists public.exam_result_files (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.exam_results(id) on delete restrict,
  center_id uuid not null references public.exam_centers(id) on delete restrict,
  storage_path text not null unique,
  file_name text not null check(length(file_name) between 1 and 180),
  content_type text not null check(content_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes bigint not null check(size_bytes between 1 and 10485760),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists exam_result_files_result_idx on public.exam_result_files(result_id);

create table if not exists public.exam_result_access_log (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.exam_results(id) on delete restrict,
  center_id uuid not null references public.exam_centers(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action_key text not null check(action_key in ('view','download')),
  created_at timestamptz not null default now()
);
create index if not exists exam_result_access_log_result_idx on public.exam_result_access_log(result_id,created_at desc);

create or replace function private.exam_guard_result_write()
returns trigger
language plpgsql
set search_path=''
as $function$
declare v_client uuid; v_center uuid;
begin
  if tg_op='INSERT' then
    if not private.exam_has_capability(new.center_id,'results_draft') then
      raise exception 'Droit de préparation de résultat requis' using errcode='42501';
    end if;
    select a.client_id,a.center_id into v_client,v_center
    from public.exam_appointments a where a.id=new.appointment_id;
    if v_client is null or v_client<>new.client_id or v_center<>new.center_id then
      raise exception 'Le résultat ne correspond pas au rendez-vous indiqué' using errcode='23514';
    end if;
    new.status:='draft';
    new.drafted_by:=auth.uid();
    new.validated_by:=null;
    new.published_by:=null;
    new.validated_at:=null;
    new.published_at:=null;
  else
    if new.center_id is distinct from old.center_id
      or new.appointment_id is distinct from old.appointment_id
      or new.client_id is distinct from old.client_id
      or new.drafted_by is distinct from old.drafted_by then
      raise exception 'Le rattachement du résultat est immuable' using errcode='42501';
    end if;
    if old.status='draft' and new.status='draft' then
      if not private.exam_has_capability(old.center_id,'results_draft') then
        raise exception 'Droit de préparation de résultat requis' using errcode='42501';
      end if;
    elsif old.status='draft' and new.status='validated' then
      if not private.exam_has_capability(old.center_id,'results_validate')
        or old.drafted_by=auth.uid() then
        raise exception 'Validation indépendante requise' using errcode='42501';
      end if;
      new.validated_by:=auth.uid(); new.validated_at:=now();
    elsif old.status='validated' and new.status='published' then
      if not private.exam_has_capability(old.center_id,'results_publish')
        or old.validated_by is null then
        raise exception 'Publication réservée au professionnel habilité' using errcode='42501';
      end if;
      new.published_by:=auth.uid(); new.published_at:=now();
    elsif old.status in ('validated','published') and new.status='withdrawn' then
      if not private.exam_has_capability(old.center_id,'results_publish') then
        raise exception 'Retrait du résultat réservé au professionnel habilité' using errcode='42501';
      end if;
    else
      raise exception 'Transition de résultat interdite' using errcode='23514';
    end if;
  end if;
  new.updated_at:=now();
  return new;
end;
$function$;

drop trigger if exists exam_result_write_guard on public.exam_results;
create trigger exam_result_write_guard
before insert or update on public.exam_results
for each row execute function private.exam_guard_result_write();

create or replace function private.exam_guard_result_content()
returns trigger
language plpgsql
set search_path=''
as $function$
declare v_center uuid; v_status text;
begin
  select r.center_id,r.status into v_center,v_status
  from public.exam_results r where r.id=coalesce(new.result_id,old.result_id);
  if v_center is null or v_status<>'draft'
    or not private.exam_has_capability(v_center,'results_draft') then
    raise exception 'Le contenu médical ne peut être modifié que pendant la préparation' using errcode='42501';
  end if;
  new.updated_by:=auth.uid(); new.updated_at:=now();
  return new;
end;
$function$;

drop trigger if exists exam_result_content_guard on public.exam_result_contents;
create trigger exam_result_content_guard
before insert or update on public.exam_result_contents
for each row execute function private.exam_guard_result_content();

create or replace function public.exam_create_result_draft(
  p_center_id uuid,
  p_appointment_id uuid,
  p_title text,
  p_report_text text,
  p_conclusion text default null
)
returns uuid
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_client uuid;
  v_result uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise' using errcode='28000'; end if;
  if length(trim(coalesce(p_title,'')))<2 or length(trim(coalesce(p_report_text,'')))<1
    or length(p_report_text)>50000 or length(coalesce(p_conclusion,''))>10000 then
    raise exception 'Contenu du compte rendu invalide' using errcode='22023';
  end if;
  if not private.exam_has_capability(p_center_id,'results_draft') then
    raise exception 'Droit de préparation de résultat requis' using errcode='42501';
  end if;
  select a.client_id into v_client
  from public.exam_appointments a
  where a.id=p_appointment_id and a.center_id=p_center_id and a.status='completed';
  if v_client is null then raise exception 'Un rendez-vous réalisé du centre est requis' using errcode='23514'; end if;
  insert into public.exam_results(center_id,appointment_id,client_id,title)
  values(p_center_id,p_appointment_id,v_client,trim(p_title))
  returning id into v_result;
  insert into public.exam_result_contents(result_id,report_text,conclusion)
  values(v_result,p_report_text,nullif(trim(coalesce(p_conclusion,'')),''));
  return v_result;
end;
$function$;
revoke all on function public.exam_create_result_draft(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.exam_create_result_draft(uuid,uuid,text,text,text) to authenticated;

create table if not exists public.exam_equipment (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.exam_centers(id) on delete restrict,
  name text not null check(length(trim(name)) between 2 and 180),
  category text not null check(category in ('laboratoire','imagerie','cardiologie','monitoring','autre')),
  manufacturer text,
  model text,
  serial_number text,
  status text not null default 'operational' check(status in ('operational','maintenance','out_of_service','retired')),
  image_url text,
  image_alt text,
  image_source_url text,
  image_license text,
  image_verified_at timestamptz,
  is_public boolean not null default false,
  purchased_at date,
  warranty_until date,
  next_maintenance_at date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(image_url is null or (image_url like 'https://%' and image_source_url like 'https://%' and coalesce(length(trim(image_license)),0)>0))
);
create index if not exists exam_equipment_center_status_idx on public.exam_equipment(center_id,status,category);
create index if not exists exam_equipment_public_idx on public.exam_equipment(center_id,is_public) where is_public;

create table if not exists public.exam_equipment_maintenance (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.exam_centers(id) on delete restrict,
  equipment_id uuid not null references public.exam_equipment(id) on delete restrict,
  maintenance_type text not null check(maintenance_type in ('preventive','corrective','calibration','inspection')),
  status text not null default 'planned' check(status in ('planned','in_progress','completed','cancelled')),
  scheduled_at timestamptz,
  performed_at timestamptz,
  provider_name text,
  notes text,
  cost_fcfa bigint not null default 0 check(cost_fcfa>=0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists exam_equipment_maintenance_center_idx on public.exam_equipment_maintenance(center_id,status,scheduled_at);

create table if not exists public.exam_security_incidents (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.exam_centers(id) on delete restrict,
  category text not null check(category in ('cyber','confidentialite','biologique','materiel','locaux','qualite','autre')),
  severity text not null check(severity in ('low','medium','high','critical')),
  state text not null default 'NOUVEAU' check(state in ('NOUVEAU','EN_ANALYSE','CONFINEMENT','CORRECTION','SURVEILLANCE','CLOTURE')),
  title text not null check(length(trim(title)) between 3 and 180),
  description text not null check(length(trim(description)) between 3 and 5000),
  resolution_summary text,
  opened_by uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists exam_security_incidents_center_state_idx on public.exam_security_incidents(center_id,state,severity,created_at desc);

create table if not exists public.exam_security_audit_log (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.exam_centers(id) on delete restrict,
  incident_id uuid not null references public.exam_security_incidents(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  action_key text not null,
  from_state text,
  to_state text,
  created_at timestamptz not null default now()
);
create index if not exists exam_security_audit_log_center_idx on public.exam_security_audit_log(center_id,created_at desc);

create or replace function private.exam_guard_incident()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if tg_op='INSERT' then
    if not private.exam_has_capability(new.center_id,'incident_report') then
      raise exception 'Seuls les membres actifs du centre peuvent déclarer un incident' using errcode='42501';
    end if;
    new.opened_by:=auth.uid();
    new.state:='NOUVEAU';
    insert into public.exam_security_audit_log(center_id,incident_id,actor_id,action_key,from_state,to_state)
    values(new.center_id,new.id,auth.uid(),'incident.created',null,'NOUVEAU');
  else
    if new.id is distinct from old.id or new.center_id is distinct from old.center_id
      or new.opened_by is distinct from old.opened_by then
      raise exception 'Identité et rattachement de l’incident immuables' using errcode='42501';
    end if;
    if not private.exam_has_capability(old.center_id,'security_manage') and not public.is_admin() then
      raise exception 'Gestion des incidents réservée à la sécurité du centre ou à NAXA Admin' using errcode='42501';
    end if;
    if old.state is distinct from new.state then
      if not (
        (old.state='NOUVEAU' and new.state='EN_ANALYSE')
        or (old.state='EN_ANALYSE' and new.state in ('CONFINEMENT','CORRECTION'))
        or (old.state='CONFINEMENT' and new.state in ('CORRECTION','SURVEILLANCE'))
        or (old.state='CORRECTION' and new.state='SURVEILLANCE')
        or (old.state='SURVEILLANCE' and new.state='CLOTURE')
      ) then raise exception 'Transition de traitement non autorisée' using errcode='23514'; end if;
      if new.state='CLOTURE' then
        new.closed_by:=auth.uid(); new.closed_at:=now();
      else
        new.closed_by:=old.closed_by; new.closed_at:=old.closed_at;
      end if;
      insert into public.exam_security_audit_log(center_id,incident_id,actor_id,action_key,from_state,to_state)
      values(old.center_id,old.id,auth.uid(),'incident.state_changed',old.state,new.state);
    else
      new.closed_by:=old.closed_by; new.closed_at:=old.closed_at;
    end if;
    new.updated_at:=now();
  end if;
  return new;
end;
$function$;

drop trigger if exists exam_security_incident_guard on public.exam_security_incidents;
create trigger exam_security_incident_guard
before insert or update on public.exam_security_incidents
for each row execute function private.exam_guard_incident();

create table if not exists public.exam_accounting_events (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.exam_centers(id) on delete restrict,
  direction text not null check(direction in ('income','expense')),
  category text not null check(length(trim(category)) between 2 and 100),
  label text not null check(length(trim(label)) between 2 and 220),
  amount_fcfa bigint not null check(amount_fcfa>0),
  payment_method text,
  event_date date not null default (now() at time zone 'Africa/Douala')::date,
  status text not null default 'draft' check(status in ('draft','posted','void')),
  reference text,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists exam_accounting_events_center_date_idx on public.exam_accounting_events(center_id,event_date desc,status);

create or replace function private.exam_guard_accounting_event()
returns trigger
language plpgsql
set search_path=''
as $function$
begin
  if tg_op='INSERT' then
    if not private.exam_has_capability(new.center_id,'finance_write') then
      raise exception 'Droit de saisie comptable requis' using errcode='42501';
    end if;
    if new.status<>'draft' then raise exception 'Une écriture doit commencer en brouillon' using errcode='23514'; end if;
    new.created_by:=auth.uid();
  else
    if old.status<>'draft' or not private.exam_has_capability(old.center_id,'finance_write') then
      raise exception 'Seules les écritures brouillon sont modifiables' using errcode='42501';
    end if;
    if new.status='posted' or new.status='void' then
      if not private.exam_has_capability(old.center_id,'finance_approve') then
        raise exception 'Validation comptable requise' using errcode='42501';
      end if;
      new.approved_by:=auth.uid(); new.approved_at:=now();
    elsif new.status<>'draft' then
      raise exception 'Statut comptable invalide' using errcode='23514';
    else
      new.approved_by:=old.approved_by; new.approved_at:=old.approved_at;
    end if;
    if new.center_id is distinct from old.center_id or new.created_by is distinct from old.created_by then
      raise exception 'Le rattachement comptable est immuable' using errcode='42501';
    end if;
    new.updated_at:=now();
  end if;
  return new;
end;
$function$;

drop trigger if exists exam_accounting_event_guard on public.exam_accounting_events;
create trigger exam_accounting_event_guard
before insert or update on public.exam_accounting_events
for each row execute function private.exam_guard_accounting_event();

create table if not exists public.exam_conversations (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.exam_centers(id) on delete restrict,
  client_id uuid not null references auth.users(id) on delete restrict,
  appointment_id uuid references public.exam_appointments(id) on delete set null,
  subject text not null check(length(trim(subject)) between 2 and 180),
  status text not null default 'open' check(status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists exam_conversations_center_idx on public.exam_conversations(center_id,status,updated_at desc);
create index if not exists exam_conversations_client_idx on public.exam_conversations(client_id,updated_at desc);

create table if not exists public.exam_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.exam_conversations(id) on delete restrict,
  sender_id uuid not null references auth.users(id) on delete restrict,
  body text not null check(length(trim(body)) between 1 and 5000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists exam_messages_conversation_idx on public.exam_messages(conversation_id,created_at);

create table if not exists public.exam_notifications (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.exam_centers(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  appointment_id uuid references public.exam_appointments(id) on delete restrict,
  notification_type text not null,
  title text not null check(length(trim(title)) between 2 and 180),
  body text not null check(length(trim(body)) between 1 and 1000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists exam_notifications_appointment_type_unique
  on public.exam_notifications(appointment_id,notification_type) where appointment_id is not null;
create index if not exists exam_notifications_user_idx on public.exam_notifications(user_id,created_at desc);

create table if not exists public.exam_ai_action_audit (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.exam_centers(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  actor_role text not null,
  action_key text not null check(action_key in ('daily_operations_summary','prepare_appointment_reminders')),
  scope_summary text not null check(length(scope_summary) between 1 and 1000),
  status text not null check(status in ('prepared','executed','rejected')),
  result_summary text,
  model_version text not null default 'naxa-rules-v1',
  created_at timestamptz not null default now(),
  executed_at timestamptz
);
create index if not exists exam_ai_action_audit_center_idx on public.exam_ai_action_audit(center_id,created_at desc);

-- Statuts et rôles sont déterminés côté base, jamais par user_metadata.
alter table public.exam_staff_assignments enable row level security;
alter table public.exam_results enable row level security;
alter table public.exam_result_contents enable row level security;
alter table public.exam_result_files enable row level security;
alter table public.exam_result_access_log enable row level security;
alter table public.exam_equipment enable row level security;
alter table public.exam_equipment_maintenance enable row level security;
alter table public.exam_security_incidents enable row level security;
alter table public.exam_security_audit_log enable row level security;
alter table public.exam_accounting_events enable row level security;
alter table public.exam_conversations enable row level security;
alter table public.exam_messages enable row level security;
alter table public.exam_notifications enable row level security;
alter table public.exam_ai_action_audit enable row level security;

grant select,insert,update on public.exam_staff_assignments to authenticated;
grant select,insert,update on public.exam_results to authenticated;
grant select,insert,update on public.exam_result_contents to authenticated;
grant select,insert on public.exam_result_files to authenticated;
grant select,insert on public.exam_result_access_log to authenticated;
grant select,insert,update on public.exam_equipment to authenticated;
grant select on public.exam_equipment to anon;
grant select,insert,update on public.exam_equipment_maintenance to authenticated;
grant select,insert,update on public.exam_security_incidents to authenticated;
grant select on public.exam_security_audit_log to authenticated;
grant select,insert,update on public.exam_accounting_events to authenticated;
grant select,insert,update on public.exam_conversations to authenticated;
grant select,insert,update on public.exam_messages to authenticated;
grant select,insert,update on public.exam_notifications to authenticated;
grant select,insert,update on public.exam_ai_action_audit to authenticated;

-- Centre et affectations : contrôle par rôle autonome, actif et centre précis.
drop policy if exists exam_centers_staff_read on public.exam_centers;
create policy exam_centers_staff_read on public.exam_centers for select to authenticated
using (private.exam_has_capability(id,'appointments_read') or private.exam_has_capability(id,'staff_read'));

drop policy if exists exam_staff_self_or_manager_read on public.exam_staff_assignments;
create policy exam_staff_self_or_manager_read on public.exam_staff_assignments for select to authenticated
using (user_id=(select auth.uid()) or private.exam_has_capability(center_id,'staff_manage') or private.exam_has_capability(center_id,'staff_read'));

drop policy if exists exam_staff_manager_insert on public.exam_staff_assignments;
create policy exam_staff_manager_insert on public.exam_staff_assignments for insert to authenticated
with check (
  private.exam_has_capability(center_id,'staff_manage')
  and role_key<>'directeur'
  and is_active is true and revoked_at is null
  and assigned_by=(select auth.uid())
);

drop policy if exists exam_staff_self_or_manager_update on public.exam_staff_assignments;
create policy exam_staff_self_or_manager_update on public.exam_staff_assignments for update to authenticated
using (
  (user_id=(select auth.uid()) and is_active is true and revoked_at is null)
  or private.exam_has_capability(center_id,'staff_manage')
)
with check (
  (user_id=(select auth.uid()) and is_active is true and revoked_at is null)
  or private.exam_has_capability(center_id,'staff_manage')
);

drop policy if exists exam_appointments_staff_read on public.exam_appointments;
create policy exam_appointments_staff_read on public.exam_appointments for select to authenticated
using (private.exam_has_capability(center_id,'appointments_read'));

create or replace function public.transition_exam_appointment(p_appointment_id uuid,p_next_status text)
returns text
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_appointment public.exam_appointments%rowtype;
  v_allowed boolean:=false;
begin
  if v_user is null then raise exception 'Connexion requise' using errcode='28000'; end if;
  if p_appointment_id is null or p_next_status not in ('confirmed','completed','cancelled') then
    raise exception 'Transition invalide' using errcode='22023';
  end if;
  if not exists(select 1 from public.profiles p where p.id=v_user and p.actif is true) then
    raise exception 'Compte inactif' using errcode='42501';
  end if;
  select a.* into v_appointment from public.exam_appointments a where a.id=p_appointment_id for update;
  if not found then raise exception 'Réservation introuvable' using errcode='P0002'; end if;
  if not private.exam_has_capability(v_appointment.center_id,'appointments_manage') then
    raise exception 'Droit de gestion des rendez-vous requis' using errcode='42501';
  end if;
  v_allowed :=
    (v_appointment.status='booked' and p_next_status in ('confirmed','cancelled'))
    or (v_appointment.status='confirmed' and p_next_status in ('completed','cancelled'));
  if not v_allowed then raise exception 'Transition impossible depuis le statut %',v_appointment.status using errcode='23514'; end if;
  if p_next_status='cancelled' then
    update public.exam_slots set reserved_count=reserved_count-1
    where id=v_appointment.slot_id and reserved_count>0;
    if not found then raise exception 'Compteur de places incohérent; annulation interrompue' using errcode='23514'; end if;
  end if;
  update public.exam_appointments set status=p_next_status,updated_at=now() where id=p_appointment_id;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_user,'exam_appointment_status_changed','exam_appointment',p_appointment_id::text,
    jsonb_build_object('center_id',v_appointment.center_id,'ticket_code',v_appointment.ticket_code,
      'from_status',v_appointment.status,'to_status',p_next_status));
  return p_next_status;
end;
$function$;
revoke all on function public.transition_exam_appointment(uuid,text) from public,anon;
grant execute on function public.transition_exam_appointment(uuid,text) to authenticated;

-- Résultats : métadonnées séparées du texte médical pour appliquer le moindre privilège.
drop policy if exists exam_results_client_published_read on public.exam_results;
create policy exam_results_client_published_read on public.exam_results for select to authenticated
using (client_id=(select auth.uid()) and status='published');

drop policy if exists exam_results_staff_metadata_read on public.exam_results;
create policy exam_results_staff_metadata_read on public.exam_results for select to authenticated
using (
  private.exam_has_capability(center_id,'result_metadata_read')
  or private.exam_has_capability(center_id,'results_read')
  or private.exam_has_capability(center_id,'results_draft')
);

drop policy if exists exam_results_admin_metadata_read on public.exam_results;
create policy exam_results_admin_metadata_read on public.exam_results for select to authenticated
using (public.is_admin());

drop policy if exists exam_results_staff_insert on public.exam_results;
create policy exam_results_staff_insert on public.exam_results for insert to authenticated
with check (private.exam_has_capability(center_id,'results_draft') and status='draft' and drafted_by=(select auth.uid()));

drop policy if exists exam_results_staff_update on public.exam_results;
create policy exam_results_staff_update on public.exam_results for update to authenticated
using (
  private.exam_has_capability(center_id,'results_draft')
  or private.exam_has_capability(center_id,'results_validate')
  or private.exam_has_capability(center_id,'results_publish')
)
with check (
  private.exam_has_capability(center_id,'results_draft')
  or private.exam_has_capability(center_id,'results_validate')
  or private.exam_has_capability(center_id,'results_publish')
);

drop policy if exists exam_result_contents_client_published_read on public.exam_result_contents;
create policy exam_result_contents_client_published_read on public.exam_result_contents for select to authenticated
using (exists(select 1 from public.exam_results r where r.id=result_id and r.client_id=(select auth.uid()) and r.status='published'));

drop policy if exists exam_result_contents_staff_read on public.exam_result_contents;
create policy exam_result_contents_staff_read on public.exam_result_contents for select to authenticated
using (exists(select 1 from public.exam_results r where r.id=result_id and private.exam_has_capability(r.center_id,'results_read')));

drop policy if exists exam_result_contents_staff_insert on public.exam_result_contents;
create policy exam_result_contents_staff_insert on public.exam_result_contents for insert to authenticated
with check (exists(select 1 from public.exam_results r where r.id=result_id and r.status='draft' and private.exam_has_capability(r.center_id,'results_draft')));

drop policy if exists exam_result_contents_staff_update on public.exam_result_contents;
create policy exam_result_contents_staff_update on public.exam_result_contents for update to authenticated
using (exists(select 1 from public.exam_results r where r.id=result_id and r.status='draft' and private.exam_has_capability(r.center_id,'results_draft')))
with check (exists(select 1 from public.exam_results r where r.id=result_id and r.status='draft' and private.exam_has_capability(r.center_id,'results_draft')));

drop policy if exists exam_result_files_client_published_read on public.exam_result_files;
create policy exam_result_files_client_published_read on public.exam_result_files for select to authenticated
using (exists(select 1 from public.exam_results r where r.id=result_id and r.client_id=(select auth.uid()) and r.status='published'));

drop policy if exists exam_result_files_staff_read on public.exam_result_files;
create policy exam_result_files_staff_read on public.exam_result_files for select to authenticated
using (private.exam_has_capability(center_id,'result_files_read'));

drop policy if exists exam_result_files_staff_insert on public.exam_result_files;
create policy exam_result_files_staff_insert on public.exam_result_files for insert to authenticated
with check (
  uploaded_by=(select auth.uid())
  and private.exam_has_capability(center_id,'results_draft')
  and split_part(storage_path,'/',1)=center_id::text
  and split_part(storage_path,'/',2)=result_id::text
  and exists(select 1 from public.exam_results r where r.id=result_id and r.center_id=exam_result_files.center_id and r.status='draft')
);

drop policy if exists exam_result_access_log_client_read on public.exam_result_access_log;
create policy exam_result_access_log_client_read on public.exam_result_access_log for select to authenticated
using (actor_id=(select auth.uid()));

drop policy if exists exam_result_access_log_staff_read on public.exam_result_access_log;
create policy exam_result_access_log_staff_read on public.exam_result_access_log for select to authenticated
using (private.exam_has_capability(center_id,'security_read') or private.exam_has_capability(center_id,'results_read'));

drop policy if exists exam_result_access_log_insert on public.exam_result_access_log;
create policy exam_result_access_log_insert on public.exam_result_access_log for insert to authenticated
with check (
  actor_id=(select auth.uid())
  and (
    private.exam_has_capability(center_id,'results_read')
    or exists(select 1 from public.exam_results r where r.id=result_id and r.client_id=(select auth.uid()) and r.status='published')
  )
);

-- Stockage des comptes rendus : privé, sans URL publique ni clé privilégiée côté navigateur.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('exam-results','exam-results',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf','image/jpeg','image/png'];

drop policy if exists exam_results_storage_staff_upload on storage.objects;
create policy exam_results_storage_staff_upload on storage.objects for insert to authenticated
with check (
  bucket_id='exam-results'
  and exists(
    select 1 from public.exam_results r
    where r.id::text=split_part(name,'/',2)
      and r.center_id::text=split_part(name,'/',1)
      and r.status='draft'
      and private.exam_has_capability(r.center_id,'results_draft')
  )
);

drop policy if exists exam_results_storage_scoped_read on storage.objects;
create policy exam_results_storage_scoped_read on storage.objects for select to authenticated
using (
  bucket_id='exam-results'
  and exists(
    select 1
    from public.exam_result_files f
    join public.exam_results r on r.id=f.result_id
    where f.storage_path=name
      and (
        (r.client_id=(select auth.uid()) and r.status='published')
        or private.exam_has_capability(r.center_id,'result_files_read')
      )
  )
);

-- Equipements : image exposable uniquement après traçabilité de la source et licence.
drop policy if exists exam_equipment_staff_read on public.exam_equipment;
create policy exam_equipment_staff_read on public.exam_equipment for select to authenticated
using (private.exam_has_capability(center_id,'equipment_read') or private.exam_has_capability(center_id,'equipment_manage'));

drop policy if exists exam_equipment_public_verified_read on public.exam_equipment;
create policy exam_equipment_public_verified_read on public.exam_equipment for select to anon,authenticated
using (is_public is true and image_url like 'https://%' and image_source_url like 'https://%' and image_license is not null and image_verified_at is not null);

drop policy if exists exam_equipment_staff_insert on public.exam_equipment;
create policy exam_equipment_staff_insert on public.exam_equipment for insert to authenticated
with check (private.exam_has_capability(center_id,'equipment_manage') and created_by=(select auth.uid()) and is_public is false);

drop policy if exists exam_equipment_staff_update on public.exam_equipment;
create policy exam_equipment_staff_update on public.exam_equipment for update to authenticated
using (private.exam_has_capability(center_id,'equipment_manage'))
with check (private.exam_has_capability(center_id,'equipment_manage'));

drop policy if exists exam_equipment_maintenance_staff_read on public.exam_equipment_maintenance;
create policy exam_equipment_maintenance_staff_read on public.exam_equipment_maintenance for select to authenticated
using (private.exam_has_capability(center_id,'equipment_read') or private.exam_has_capability(center_id,'equipment_manage'));

drop policy if exists exam_equipment_maintenance_staff_insert on public.exam_equipment_maintenance;
create policy exam_equipment_maintenance_staff_insert on public.exam_equipment_maintenance for insert to authenticated
with check (
  private.exam_has_capability(center_id,'equipment_manage')
  and created_by=(select auth.uid())
  and exists(select 1 from public.exam_equipment e where e.id=equipment_id and e.center_id=exam_equipment_maintenance.center_id)
);

drop policy if exists exam_equipment_maintenance_staff_update on public.exam_equipment_maintenance;
create policy exam_equipment_maintenance_staff_update on public.exam_equipment_maintenance for update to authenticated
using (private.exam_has_capability(center_id,'equipment_manage'))
with check (private.exam_has_capability(center_id,'equipment_manage'));


drop policy if exists exam_equipment_admin_read on public.exam_equipment;
create policy exam_equipment_admin_read on public.exam_equipment for select to authenticated
using (public.is_admin());

-- Sécurité et incidents opérationnels / cyber / confidentialité / biologique.
drop policy if exists exam_security_incidents_staff_read on public.exam_security_incidents;
create policy exam_security_incidents_staff_read on public.exam_security_incidents for select to authenticated
using (opened_by=(select auth.uid()) or private.exam_has_capability(center_id,'security_read') or private.exam_has_capability(center_id,'security_manage'));

drop policy if exists exam_security_incidents_admin_read on public.exam_security_incidents;
create policy exam_security_incidents_admin_read on public.exam_security_incidents for select to authenticated
using (public.is_admin());

drop policy if exists exam_security_incidents_staff_insert on public.exam_security_incidents;
create policy exam_security_incidents_staff_insert on public.exam_security_incidents for insert to authenticated
with check (private.exam_has_capability(center_id,'incident_report') and opened_by=(select auth.uid()));

drop policy if exists exam_security_incidents_staff_update on public.exam_security_incidents;
create policy exam_security_incidents_staff_update on public.exam_security_incidents for update to authenticated
using (private.exam_has_capability(center_id,'security_manage') or public.is_admin())
with check (private.exam_has_capability(center_id,'security_manage') or public.is_admin());

drop policy if exists exam_security_audit_log_staff_read on public.exam_security_audit_log;
create policy exam_security_audit_log_staff_read on public.exam_security_audit_log for select to authenticated
using (private.exam_has_capability(center_id,'security_read') or public.is_admin());

-- Comptabilité centre séparée par center_id, saisie en brouillon et validation humaine.
drop policy if exists exam_accounting_events_staff_read on public.exam_accounting_events;
create policy exam_accounting_events_staff_read on public.exam_accounting_events for select to authenticated
using (private.exam_has_capability(center_id,'finance_read'));

drop policy if exists exam_accounting_events_admin_read on public.exam_accounting_events;
create policy exam_accounting_events_admin_read on public.exam_accounting_events for select to authenticated
using (public.is_admin());

drop policy if exists exam_accounting_events_staff_insert on public.exam_accounting_events;
create policy exam_accounting_events_staff_insert on public.exam_accounting_events for insert to authenticated
with check (private.exam_has_capability(center_id,'finance_write') and status='draft' and created_by=(select auth.uid()));

drop policy if exists exam_accounting_events_staff_update on public.exam_accounting_events;
create policy exam_accounting_events_staff_update on public.exam_accounting_events for update to authenticated
using (private.exam_has_capability(center_id,'finance_write') and status='draft')
with check (private.exam_has_capability(center_id,'finance_write') or private.exam_has_capability(center_id,'finance_approve'));

-- Communication dédiée : les clients ne voient que leurs conversations et messages.
drop policy if exists exam_conversations_client_or_staff_read on public.exam_conversations;
create policy exam_conversations_client_or_staff_read on public.exam_conversations for select to authenticated
using (client_id=(select auth.uid()) or private.exam_has_capability(center_id,'communications_read'));

drop policy if exists exam_conversations_client_insert on public.exam_conversations;
create policy exam_conversations_client_insert on public.exam_conversations for insert to authenticated
with check (
  client_id=(select auth.uid())
  and exists(select 1 from public.exam_appointments a where a.id=appointment_id and a.client_id=(select auth.uid()) and a.center_id=exam_conversations.center_id)
);

drop policy if exists exam_conversations_staff_insert on public.exam_conversations;
create policy exam_conversations_staff_insert on public.exam_conversations for insert to authenticated
with check (private.exam_has_capability(center_id,'communications_write') and appointment_id is not null);

drop policy if exists exam_conversations_staff_update on public.exam_conversations;
create policy exam_conversations_staff_update on public.exam_conversations for update to authenticated
using (private.exam_has_capability(center_id,'communications_write'))
with check (private.exam_has_capability(center_id,'communications_write'));

create or replace function private.exam_guard_conversation()
returns trigger language plpgsql set search_path=''
as $function$
declare v_client uuid; v_center uuid;
begin
  if tg_op='INSERT' then
    if new.appointment_id is null then raise exception 'Un rendez-vous doit rattacher la conversation' using errcode='23514'; end if;
    select client_id,center_id into v_client,v_center from public.exam_appointments where id=new.appointment_id;
    if v_client is null or v_client<>new.client_id or v_center<>new.center_id then
      raise exception 'Conversation non rattachée au bon rendez-vous/client' using errcode='23514';
    end if;
  else
    if new.id is distinct from old.id or new.center_id is distinct from old.center_id
      or new.client_id is distinct from old.client_id or new.appointment_id is distinct from old.appointment_id
      or new.subject is distinct from old.subject then
      raise exception 'Le périmètre de la conversation est immuable' using errcode='42501';
    end if;
    new.updated_at:=now();
  end if;
  return new;
end;
$function$;

drop trigger if exists exam_conversation_guard on public.exam_conversations;
create trigger exam_conversation_guard before insert or update on public.exam_conversations
for each row execute function private.exam_guard_conversation();

drop policy if exists exam_messages_client_or_staff_read on public.exam_messages;
create policy exam_messages_client_or_staff_read on public.exam_messages for select to authenticated
using (exists(
  select 1 from public.exam_conversations c
  where c.id=conversation_id
    and (c.client_id=(select auth.uid()) or private.exam_has_capability(c.center_id,'communications_read'))
));

drop policy if exists exam_messages_client_or_staff_insert on public.exam_messages;
create policy exam_messages_client_or_staff_insert on public.exam_messages for insert to authenticated
with check (
  sender_id=(select auth.uid())
  and exists(
    select 1 from public.exam_conversations c
    where c.id=conversation_id and c.status='open'
      and (c.client_id=(select auth.uid()) or private.exam_has_capability(c.center_id,'communications_write'))
  )
);

drop policy if exists exam_messages_read_update on public.exam_messages;
create policy exam_messages_read_update on public.exam_messages for update to authenticated
using (
  exists(select 1 from public.exam_conversations c where c.id=conversation_id and
    (c.client_id=(select auth.uid()) or private.exam_has_capability(c.center_id,'communications_read')))
)
with check (
  exists(select 1 from public.exam_conversations c where c.id=conversation_id and
    (c.client_id=(select auth.uid()) or private.exam_has_capability(c.center_id,'communications_read')))
);

drop policy if exists exam_notifications_recipient_read on public.exam_notifications;
create policy exam_notifications_recipient_read on public.exam_notifications for select to authenticated
using (user_id=(select auth.uid()) or private.exam_has_capability(center_id,'communications_read'));

drop policy if exists exam_notifications_staff_insert on public.exam_notifications;
create policy exam_notifications_staff_insert on public.exam_notifications for insert to authenticated
with check (private.exam_has_capability(center_id,'communications_write'));

drop policy if exists exam_notifications_recipient_update on public.exam_notifications;
create policy exam_notifications_recipient_update on public.exam_notifications for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));

-- Journal des actions d'assistance : uniquement métadonnées opérationnelles, jamais le contenu médical.
drop policy if exists exam_ai_action_audit_actor_read on public.exam_ai_action_audit;
create policy exam_ai_action_audit_actor_read on public.exam_ai_action_audit for select to authenticated
using (actor_id=(select auth.uid()) or private.exam_has_capability(center_id,'security_read'));

drop policy if exists exam_ai_action_audit_admin_read on public.exam_ai_action_audit;
create policy exam_ai_action_audit_admin_read on public.exam_ai_action_audit for select to authenticated
using (public.is_admin());

drop policy if exists exam_ai_action_audit_insert on public.exam_ai_action_audit;
create policy exam_ai_action_audit_insert on public.exam_ai_action_audit for insert to authenticated
with check (actor_id=(select auth.uid()) and status='prepared' and private.exam_has_capability(center_id,'ai_use'));

drop policy if exists exam_ai_action_audit_actor_update on public.exam_ai_action_audit;
create policy exam_ai_action_audit_actor_update on public.exam_ai_action_audit for update to authenticated
using (actor_id=(select auth.uid()) and status='prepared' and private.exam_has_capability(center_id,'ai_use'))
with check (actor_id=(select auth.uid()) and status in ('executed','rejected') and private.exam_has_capability(center_id,'ai_use'));

create or replace function private.exam_guard_ai_audit_update()
returns trigger language plpgsql set search_path=''
as $function$
begin
  if old.status<>'prepared' or new.status not in ('executed','rejected')
    or new.center_id is distinct from old.center_id
    or new.actor_id is distinct from old.actor_id
    or new.actor_role is distinct from old.actor_role
    or new.action_key is distinct from old.action_key
    or new.scope_summary is distinct from old.scope_summary
    or new.model_version is distinct from old.model_version
    or old.actor_id is distinct from auth.uid()
    or not private.exam_has_capability(old.center_id,'ai_use') then
    raise exception 'Modification de la trace IA non autorisée' using errcode='42501';
  end if;
  new.executed_at:=case when new.status='executed' then now() else null end;
  return new;
end;
$function$;

drop trigger if exists exam_ai_action_audit_guard on public.exam_ai_action_audit;
create trigger exam_ai_action_audit_guard before update on public.exam_ai_action_audit
for each row execute function private.exam_guard_ai_audit_update();

-- Notifications associées à un rendez-vous : destinataire et centre non falsifiables.
create or replace function private.exam_guard_notification()
returns trigger language plpgsql set search_path=''
as $function$
declare v_client uuid; v_center uuid;
begin
  if new.appointment_id is not null then
    select client_id,center_id into v_client,v_center from public.exam_appointments where id=new.appointment_id;
    if v_client is null or v_client<>new.user_id or v_center<>new.center_id then
      raise exception 'Notification non rattachée au bon rendez-vous/client' using errcode='23514';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists exam_notification_guard on public.exam_notifications;
create trigger exam_notification_guard before insert on public.exam_notifications
for each row execute function private.exam_guard_notification();

create or replace function private.exam_guard_notification_update()
returns trigger language plpgsql set search_path=''
as $function$
begin
  if new.id is distinct from old.id or new.center_id is distinct from old.center_id
    or new.user_id is distinct from old.user_id or new.appointment_id is distinct from old.appointment_id
    or new.notification_type is distinct from old.notification_type
    or new.title is distinct from old.title or new.body is distinct from old.body
    or new.created_at is distinct from old.created_at then
    raise exception 'Une notification ne peut être réécrite' using errcode='42501';
  end if;
  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception 'Accusé de lecture immuable' using errcode='42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists exam_notification_update_guard on public.exam_notifications;
create trigger exam_notification_update_guard before update on public.exam_notifications
for each row execute function private.exam_guard_notification_update();

-- Le contenu des messages est immuable; seul le marqueur de lecture change.
create or replace function private.exam_guard_message_update()
returns trigger language plpgsql set search_path=''
as $function$
begin
  if new.id is distinct from old.id
    or new.conversation_id is distinct from old.conversation_id
    or new.sender_id is distinct from old.sender_id
    or new.body is distinct from old.body
    or new.created_at is distinct from old.created_at then
    raise exception 'Un message envoyé ne peut être réécrit' using errcode='42501';
  end if;
  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception 'Un accusé de lecture déjà posé est immuable' using errcode='42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists exam_message_update_guard on public.exam_messages;
create trigger exam_message_update_guard before update on public.exam_messages
for each row execute function private.exam_guard_message_update();

commit;

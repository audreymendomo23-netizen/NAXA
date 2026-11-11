-- NAXA — invitations nominatives du personnel Examens et revue Admin des images.
begin;

-- Conserver l'historique des affectations révoquées et permettre une nouvelle invitation.
alter table public.exam_staff_assignments
  drop constraint if exists exam_staff_assignments_center_id_user_id_role_key_key;
create unique index if not exists exam_staff_one_active_role_key_per_center
  on public.exam_staff_assignments(center_id,user_id,role_key)
  where is_active is true and revoked_at is null;

create table if not exists public.exam_staff_invites (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  center_id uuid not null references public.exam_centers(id) on delete restrict,
  email text not null check (email=lower(trim(email)) and length(email) between 6 and 254),
  role_key text not null check (role_key in (
    'accueil','caissier','comptable','technicien_laboratoire','biologiste',
    'manipulateur_imagerie','radiologue','responsable_qualite','responsable_securite'
  )),
  inviter_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete restrict,
  assignment_id uuid references public.exam_staff_assignments(id) on delete restrict,
  revoked_at timestamptz,
  check (
    (accepted_at is null and accepted_by is null and assignment_id is null)
    or (accepted_at is not null and accepted_by is not null and assignment_id is not null)
  )
);
create index if not exists exam_staff_invites_pending_center_idx
  on public.exam_staff_invites(center_id,created_at desc)
  where accepted_at is null and revoked_at is null;
create index if not exists exam_staff_invites_pending_expiry_idx
  on public.exam_staff_invites(expires_at)
  where accepted_at is null and revoked_at is null;

alter table public.exam_staff_invites enable row level security;
revoke all on public.exam_staff_invites from public,anon,authenticated;
grant all on public.exam_staff_invites to service_role;

-- Les images restent privées. L'Admin peut uniquement horodater la revue des droits
-- sans publier l'équipement ni modifier son périmètre.
drop policy if exists exam_equipment_admin_image_review on public.exam_equipment;
create policy exam_equipment_admin_image_review
  on public.exam_equipment
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin() and is_public is false);

create or replace function private.exam_create_staff_invite_impl(
  p_center_id uuid,
  p_email text,
  p_role_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email,'')));
  v_center_status text;
  v_token uuid;
begin
  if v_actor is null or not private.exam_has_capability(p_center_id,'staff_manage') then
    raise exception 'Gestion du personnel du centre requise' using errcode='42501';
  end if;
  if p_center_id is null
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or p_role_key not in (
      'accueil','caissier','comptable','technicien_laboratoire','biologiste',
      'manipulateur_imagerie','radiologue','responsable_qualite','responsable_securite'
    ) then
    raise exception 'Adresse e-mail, centre ou poste invalide' using errcode='22023';
  end if;

  select c.status into v_center_status
  from public.exam_centers c where c.id=p_center_id;
  if v_center_status is null or v_center_status='suspended' then
    raise exception 'Le centre est introuvable ou suspendu' using errcode='42501';
  end if;

  update public.exam_staff_invites
     set revoked_at=now()
   where center_id=p_center_id and email=v_email
     and accepted_at is null and revoked_at is null;

  insert into public.exam_staff_invites(center_id,email,role_key,inviter_id)
  values(p_center_id,v_email,p_role_key,v_actor)
  returning token into v_token;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'exam.staff_invite.created','exam_staff_invite',v_token::text,
    jsonb_build_object('center_id',p_center_id,'role_key',p_role_key));

  return v_token;
end;
$function$;

create or replace function private.exam_list_staff_invites_impl(p_center_id uuid)
returns table(
  invite_id uuid,
  email text,
  role_key text,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not private.exam_has_capability(p_center_id,'staff_manage') then
    raise exception 'Gestion du personnel du centre requise' using errcode='42501';
  end if;
  return query
    select i.id,i.email,i.role_key,i.created_at,i.expires_at
    from public.exam_staff_invites i
    where i.center_id=p_center_id
      and i.accepted_at is null and i.revoked_at is null and i.expires_at>now()
    order by i.created_at desc
    limit 100;
end;
$function$;

create or replace function private.exam_revoke_staff_invite_impl(
  p_center_id uuid,
  p_invite_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_updated uuid;
begin
  if v_actor is null or not private.exam_has_capability(p_center_id,'staff_manage') then
    raise exception 'Gestion du personnel du centre requise' using errcode='42501';
  end if;
  update public.exam_staff_invites
     set revoked_at=now()
   where id=p_invite_id and center_id=p_center_id
     and accepted_at is null and revoked_at is null and expires_at>now()
  returning id into v_updated;
  if v_updated is null then
    raise exception 'Invitation en attente introuvable ou expirée' using errcode='P0002';
  end if;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'exam.staff_invite.revoked','exam_staff_invite',v_updated::text,
    jsonb_build_object('center_id',p_center_id));
  return true;
end;
$function$;

create or replace function private.exam_accept_staff_invite_impl(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_invite public.exam_staff_invites%rowtype;
  v_profile record;
  v_center_status text;
  v_active_role boolean;
  v_assignment uuid;
begin
  if v_uid is null then
    raise exception 'Connectez-vous au compte destinataire de l’invitation' using errcode='28000';
  end if;

  select lower(u.email),u.email_confirmed_at
    into v_email,v_confirmed
  from auth.users u where u.id=v_uid;
  if v_email is null or v_confirmed is null then
    raise exception 'Confirmez votre adresse e-mail avant d’accepter l’invitation' using errcode='42501';
  end if;

  select * into v_invite
  from public.exam_staff_invites
  where token=p_token
  for update;
  if not found or v_invite.email<>v_email or v_invite.accepted_at is not null
    or v_invite.revoked_at is not null or v_invite.expires_at<=now() then
    raise exception 'Invitation invalide, expirée, déjà utilisée ou destinée à une autre adresse' using errcode='42501';
  end if;

  select p.actif,p.role::text as role,p.age_verified,p.consent_accepted_at,
         p.date_of_birth,p.username,p.first_name,p.last_name,p.phone
    into v_profile
  from public.profiles p where p.id=v_uid;
  if not found or v_profile.actif is not true or v_profile.role<>'client'
    or v_profile.age_verified is not true or v_profile.consent_accepted_at is null
    or v_profile.date_of_birth is null or v_profile.username is null
    or v_profile.first_name is null or v_profile.last_name is null or v_profile.phone is null then
    raise exception 'Finalisez votre compte Client NAXA et les vérifications de majorité avant d’accepter' using errcode='42501';
  end if;

  select c.status into v_center_status
  from public.exam_centers c where c.id=v_invite.center_id;
  if v_center_status is null or v_center_status='suspended' then
    raise exception 'Le centre est introuvable ou suspendu' using errcode='42501';
  end if;

  if exists(
    select 1 from public.exam_staff_assignments a
    where a.center_id=v_invite.center_id and a.user_id=v_uid
      and a.role_key=v_invite.role_key and a.is_active is true and a.revoked_at is null
  ) then
    raise exception 'Ce compte possède déjà ce poste actif dans ce centre' using errcode='23505';
  end if;

  select not exists(
    select 1 from public.exam_staff_assignments a
    where a.center_id=v_invite.center_id and a.user_id=v_uid
      and a.is_active is true and a.active_role is true and a.revoked_at is null
  ) into v_active_role;

  insert into public.exam_staff_assignments(
    center_id,user_id,role_key,is_active,active_role,assigned_by, note
  ) values (
    v_invite.center_id,v_uid,v_invite.role_key,true,v_active_role,v_invite.inviter_id,
    'Invitation nominative acceptée par le titulaire du compte'
  ) returning id into v_assignment;

  update public.exam_staff_invites
     set accepted_at=now(),accepted_by=v_uid,assignment_id=v_assignment
   where id=v_invite.id;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'exam.staff_invite.accepted','exam_staff_assignment',v_assignment::text,
    jsonb_build_object('center_id',v_invite.center_id,'role_key',v_invite.role_key,'active_role',v_active_role));

  return jsonb_build_object(
    'accepted',true,'center_id',v_invite.center_id,
    'assignment_id',v_assignment,'role_key',v_invite.role_key,'active_role',v_active_role
  );
end;
$function$;

revoke all on function private.exam_create_staff_invite_impl(uuid,text,text) from public,anon;
revoke all on function private.exam_list_staff_invites_impl(uuid) from public,anon;
revoke all on function private.exam_revoke_staff_invite_impl(uuid,uuid) from public,anon;
revoke all on function private.exam_accept_staff_invite_impl(uuid) from public,anon;
grant execute on function private.exam_create_staff_invite_impl(uuid,text,text) to authenticated;
grant execute on function private.exam_list_staff_invites_impl(uuid) to authenticated;
grant execute on function private.exam_revoke_staff_invite_impl(uuid,uuid) to authenticated;
grant execute on function private.exam_accept_staff_invite_impl(uuid) to authenticated;

create or replace function public.exam_create_staff_invite(p_center_id uuid,p_email text,p_role_key text)
returns uuid language sql security invoker set search_path=''
as $function$ select private.exam_create_staff_invite_impl(p_center_id,p_email,p_role_key); $function$;
create or replace function public.exam_list_staff_invites(p_center_id uuid)
returns table(invite_id uuid,email text,role_key text,created_at timestamptz,expires_at timestamptz)
language sql security invoker set search_path=''
as $function$ select * from private.exam_list_staff_invites_impl(p_center_id); $function$;
create or replace function public.exam_revoke_staff_invite(p_center_id uuid,p_invite_id uuid)
returns boolean language sql security invoker set search_path=''
as $function$ select private.exam_revoke_staff_invite_impl(p_center_id,p_invite_id); $function$;
create or replace function public.exam_accept_staff_invite(p_token uuid)
returns jsonb language sql security invoker set search_path=''
as $function$ select private.exam_accept_staff_invite_impl(p_token); $function$;

revoke all on function public.exam_create_staff_invite(uuid,text,text) from public,anon;
revoke all on function public.exam_list_staff_invites(uuid) from public,anon;
revoke all on function public.exam_revoke_staff_invite(uuid,uuid) from public,anon;
revoke all on function public.exam_accept_staff_invite(uuid) from public,anon;
grant execute on function public.exam_create_staff_invite(uuid,text,text) to authenticated;
grant execute on function public.exam_list_staff_invites(uuid) to authenticated;
grant execute on function public.exam_revoke_staff_invite(uuid,uuid) to authenticated;
grant execute on function public.exam_accept_staff_invite(uuid) to authenticated;

commit;

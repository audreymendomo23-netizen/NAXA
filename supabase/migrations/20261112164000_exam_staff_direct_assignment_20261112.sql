-- NAXA Examens — affectation directe sécurisée d'un compte Client NAXA existant.
begin;

create or replace function private.exam_assign_existing_staff_impl(
  p_center_id uuid,
  p_identifier text,
  p_role_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_identifier text := trim(coalesce(p_identifier,''));
  v_matches integer;
  v_user_id uuid;
  v_profile record;
  v_center_status text;
  v_active_role boolean;
  v_assignment uuid;
begin
  if v_actor is null or not private.exam_has_capability(p_center_id,'staff_manage') then
    raise exception 'Gestion du personnel du centre requise' using errcode='42501';
  end if;

  if p_center_id is null
    or length(v_identifier)<3
    or length(v_identifier)>120
    or p_role_key is null
    or p_role_key not in (
      'accueil','caissier','comptable','technicien_laboratoire','biologiste',
      'manipulateur_imagerie','radiologue','responsable_qualite','responsable_securite'
    ) then
    raise exception 'Compte ou poste invalide' using errcode='22023';
  end if;

  select count(*), (array_agg(p.id))[1]
    into v_matches,v_user_id
  from public.profiles p
  where p.username=v_identifier or p.phone=v_identifier;

  if v_matches=0 then
    raise exception 'Aucun compte NAXA ne correspond à cet identifiant' using errcode='P0002';
  elsif v_matches>1 then
    raise exception 'Identifiant ambigu : utilisez le nom utilisateur exact' using errcode='21000';
  end if;

  if v_user_id=v_actor then
    raise exception 'Vous ne pouvez pas vous affecter vous-même' using errcode='42501';
  end if;

  select p.actif,p.role::text as role,p.age_verified,p.consent_accepted_at,
         p.date_of_birth,p.username,p.first_name,p.last_name,p.phone,
         u.email_confirmed_at
    into v_profile
  from public.profiles p
  join auth.users u on u.id=p.id
  where p.id=v_user_id;

  if not found
    or v_profile.actif is not true
    or v_profile.role<>'client'
    or v_profile.age_verified is not true
    or v_profile.consent_accepted_at is null
    or v_profile.date_of_birth is null
    or v_profile.username is null
    or v_profile.first_name is null
    or v_profile.last_name is null
    or v_profile.phone is null
    or v_profile.email_confirmed_at is null then
    raise exception 'Le compte doit être Client, actif, confirmé et entièrement vérifié' using errcode='42501';
  end if;

  select c.status into v_center_status
  from public.exam_centers c where c.id=p_center_id;
  if v_center_status is null or v_center_status='suspended' then
    raise exception 'Le centre est introuvable ou suspendu' using errcode='42501';
  end if;

  if exists (
    select 1 from public.exam_staff_assignments a
    where a.center_id=p_center_id and a.user_id=v_user_id
      and a.role_key=p_role_key and a.is_active is true and a.revoked_at is null
  ) then
    raise exception 'Ce compte possède déjà ce poste actif dans ce centre' using errcode='23505';
  end if;

  select not exists (
    select 1 from public.exam_staff_assignments a
    where a.center_id=p_center_id and a.user_id=v_user_id
      and a.is_active is true and a.active_role is true and a.revoked_at is null
  ) into v_active_role;

  insert into public.exam_staff_assignments(
    center_id,user_id,role_key,is_active,active_role,assigned_by,note
  ) values (
    p_center_id,v_user_id,p_role_key,true,v_active_role,v_actor,
    'Affectation directe par le responsable du centre'
  ) returning id into v_assignment;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'exam.staff.assigned_directly','exam_staff_assignment',v_assignment::text,
    jsonb_build_object('center_id',p_center_id,'role_key',p_role_key));

  return jsonb_build_object(
    'assigned',true,'center_id',p_center_id,'assignment_id',v_assignment,
    'user_id',v_user_id,'role_key',p_role_key,'active_role',v_active_role
  );
end;
$function$;

create or replace function public.exam_assign_existing_staff(
  p_center_id uuid,p_identifier text,p_role_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.exam_assign_existing_staff_impl(p_center_id,p_identifier,p_role_key);
$function$;

revoke all on function private.exam_assign_existing_staff_impl(uuid,text,text) from public,anon;
grant execute on function private.exam_assign_existing_staff_impl(uuid,text,text) to authenticated;
revoke all on function public.exam_assign_existing_staff(uuid,text,text) from public,anon;
grant execute on function public.exam_assign_existing_staff(uuid,text,text) to authenticated;

commit;
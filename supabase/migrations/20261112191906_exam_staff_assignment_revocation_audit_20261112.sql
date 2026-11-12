-- NAXA Examens — révocation atomique et auditée des affectations du personnel.
begin;

create or replace function private.exam_revoke_staff_assignment_impl(
  p_center_id uuid,
  p_assignment_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_target_user uuid;
  v_role_key text;
  v_is_active boolean;
  v_revoked_at timestamptz;
begin
  if v_actor is null
    or not private.exam_has_capability(p_center_id,'staff_manage') then
    raise exception 'Gestion du personnel du centre requise' using errcode='42501';
  end if;

  if p_center_id is null or p_assignment_id is null then
    raise exception 'Affectation invalide' using errcode='22023';
  end if;

  select a.user_id,a.role_key,a.is_active,a.revoked_at
    into v_target_user,v_role_key,v_is_active,v_revoked_at
  from public.exam_staff_assignments a
  where a.id=p_assignment_id and a.center_id=p_center_id
  for update;

  if not found or v_is_active is not true or v_revoked_at is not null then
    raise exception 'Affectation active introuvable' using errcode='P0002';
  end if;

  if v_target_user=v_actor then
    raise exception 'Vous ne pouvez pas révoquer votre propre affectation' using errcode='42501';
  end if;

  if v_role_key='directeur' then
    raise exception 'Le poste de direction est géré par le rattachement du partenaire' using errcode='42501';
  end if;

  update public.exam_staff_assignments
     set is_active=false,active_role=false,revoked_at=now()
   where id=p_assignment_id and center_id=p_center_id
     and is_active is true and revoked_at is null;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(
    v_actor,
    'exam.staff.assignment_revoked',
    'exam_staff_assignment',
    p_assignment_id::text,
    jsonb_build_object(
      'center_id',p_center_id,
      'target_user_id',v_target_user,
      'role_key',v_role_key
    )
  );

  return true;
end;
$function$;

create or replace function public.exam_revoke_staff_assignment(
  p_center_id uuid,
  p_assignment_id uuid
)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.exam_revoke_staff_assignment_impl(p_center_id,p_assignment_id);
$function$;

revoke all on function private.exam_revoke_staff_assignment_impl(uuid,uuid) from public,anon;
grant execute on function private.exam_revoke_staff_assignment_impl(uuid,uuid) to authenticated;
revoke all on function public.exam_revoke_staff_assignment(uuid,uuid) from public,anon;
grant execute on function public.exam_revoke_staff_assignment(uuid,uuid) to authenticated;

commit;

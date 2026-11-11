-- NAXA Examens — rejeter explicitement un poste NULL dans une invitation.
begin;

create or replace function private.exam_create_staff_invite_impl(p_center_id uuid,p_email text,p_role_key text)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_email text:=lower(trim(coalesce(p_email,'')));
  v_center_status text;
  v_token uuid;
begin
  if v_actor is null or not private.exam_has_capability(p_center_id,'staff_manage') then
    raise exception 'Gestion du personnel du centre requise' using errcode='42501';
  end if;

  if p_center_id is null
    or p_role_key is null
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

commit;

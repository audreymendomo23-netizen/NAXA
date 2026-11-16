create or replace function public.retirer_accreditation(p_id uuid)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_target uuid;
begin
 select target_profile_id into v_target
 from public.profile_accreditations where id=p_id and active=true for update;
 if v_target is null then raise exception 'Accréditation introuvable'; end if;
 if not public.is_admin() and not exists(
   select 1 from public.profile_accreditations a
   where a.id=p_id and a.grantor_profile_id=auth.uid()
 ) then raise exception 'Révocation non autorisée'; end if;
 update public.profile_accreditations
 set active=false,revoked_at=now(),revoked_by=auth.uid()
 where id=p_id;
 insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
 values(auth.uid(),'professional.accreditation_revoked','profile_accreditation',p_id::text,
   jsonb_build_object('target_profile_id',v_target,'identity_actif_mutated',false));
end
$function$;

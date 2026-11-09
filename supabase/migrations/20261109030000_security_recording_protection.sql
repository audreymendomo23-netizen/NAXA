-- NAXA Security — lot 13 : protection transactionnelle des segments vidéo.
begin;

create or replace function public.naxa_security_set_recording_protection(
  p_segment_id uuid,
  p_pharmacie_id uuid,
  p_actor_id uuid,
  p_actor_role text,
  p_protected boolean,
  p_reason text
)
returns table (
  segment_id uuid,
  segment_status text,
  segment_protected_at timestamptz,
  segment_protected_reason text
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_segment public.naxa_security_recording_segments%rowtype;
  v_now timestamptz := pg_catalog.now();
  v_operation text;
begin
  if p_segment_id is null or p_pharmacie_id is null or p_actor_id is null
     or p_actor_role not in ('promoteur','responsable','admin')
     or p_protected is null
     or p_reason is null
     or pg_catalog.length(pg_catalog.btrim(p_reason)) < 8
     or pg_catalog.length(p_reason) > 500 then
    raise exception using errcode = '22023', message = 'Invalid recording protection request';
  end if;

  select *
    into v_segment
    from public.naxa_security_recording_segments
   where id = p_segment_id
     and pharmacie_id = p_pharmacie_id
   for update;

  if not found or v_segment.status not in ('ready','protected') then
    raise exception using errcode = 'P0002', message = 'Recording segment is unavailable or not protectable';
  end if;

  if p_protected then
    update public.naxa_security_recording_segments
       set status = 'protected',
           protected_at = coalesce(v_segment.protected_at, v_now),
           protected_by = coalesce(v_segment.protected_by, p_actor_id),
           protected_reason = p_reason,
           updated_at = case
             when v_segment.status <> 'protected'
               or v_segment.protected_reason is distinct from p_reason
             then v_now else v_segment.updated_at end
     where id = p_segment_id
       and pharmacie_id = p_pharmacie_id;
    v_operation := 'protect';
  else
    if v_segment.status <> 'protected' then
      raise exception using errcode = '22023', message = 'Recording segment is not protected';
    end if;

    update public.naxa_security_recording_segments
       set status = 'ready',
           protected_at = null,
           protected_by = null,
           protected_reason = null,
           updated_at = v_now
     where id = p_segment_id
       and pharmacie_id = p_pharmacie_id;
    v_operation := 'unprotect';
  end if;

  insert into public.naxa_security_access_audit (
    pharmacie_id, actor_id, actor_role, action, resource_type, resource_id,
    justification, audit_metadata
  ) values (
    p_pharmacie_id, p_actor_id, p_actor_role, 'recording_policy_update',
    'recording_segment', p_segment_id, p_reason,
    pg_catalog.jsonb_build_object(
      'operation', v_operation,
      'camera_id', v_segment.camera_id,
      'gateway_id', v_segment.gateway_id,
      'started_at', v_segment.started_at,
      'previous_status', v_segment.status,
      'new_status', case when p_protected then 'protected' else 'ready' end
    )
  );

  return query
    select s.id, s.status, s.protected_at, s.protected_reason
      from public.naxa_security_recording_segments s
     where s.id = p_segment_id
       and s.pharmacie_id = p_pharmacie_id;
end;
$function$;

revoke all on function public.naxa_security_set_recording_protection(uuid,uuid,uuid,text,boolean,text)
  from public, anon, authenticated;
grant execute on function public.naxa_security_set_recording_protection(uuid,uuid,uuid,text,boolean,text)
  to service_role;

comment on function public.naxa_security_set_recording_protection(uuid,uuid,uuid,text,boolean,text) is
  'Protège ou libère un segment local avec verrouillage transactionnel et audit atomique ; réservé au backend NAXA.';

commit;

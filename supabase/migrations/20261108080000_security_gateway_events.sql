alter table public.naxa_security_events
  add column if not exists source_fingerprint text
  check (source_fingerprint is null or source_fingerprint ~ '^[0-9a-f]{64}$');

create unique index if not exists naxa_security_events_gateway_fingerprint_uidx
  on public.naxa_security_events(gateway_id, source_fingerprint)
  where source_fingerprint is not null;

create or replace function public.naxa_security_ingest_gateway_event(
  p_pharmacie_id uuid, p_gateway_id uuid, p_camera_id uuid,
  p_event_type text, p_source_type text, p_summary text,
  p_confidence numeric, p_detected_at timestamptz,
  p_source_fingerprint text, p_event_metadata jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_event_id uuid;
  v_summary text := pg_catalog.btrim(coalesce(p_summary, ''));
  v_metadata jsonb := coalesce(p_event_metadata, '{}'::jsonb);
  v_severity text;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_pharmacie_id is null or p_gateway_id is null
    or p_event_type is null
    or p_event_type not in (
      'motion','intrusion','line_crossing','camera_tamper','camera_obstructed',
      'signal_lost','after_hours_presence','system_offline','other'
    )
    or p_source_type is null or p_source_type not in ('onvif','edge_ai','gateway')
    or p_source_fingerprint is null
    or p_source_fingerprint !~ '^[0-9a-f]{64}$'
    or pg_catalog.length(v_summary) < 2 or pg_catalog.length(v_summary) > 280
    or v_summary ~ '[[:cntrl:]]'
    or (p_confidence is not null and (p_confidence < 0 or p_confidence > 1))
    or p_detected_at is null
    or p_detected_at < v_now - interval '7 days'
    or p_detected_at > v_now + interval '2 minutes'
    or pg_catalog.jsonb_typeof(v_metadata) <> 'object'
    or pg_catalog.jsonb_object_length(v_metadata) > 8
    or exists (
      select 1
        from pg_catalog.jsonb_object_keys(v_metadata) as metadata_key(key)
       where metadata_key.key not in (
         'event_code','event_sequence','detector_id','detector_version',
         'zone_id','rule_id','channel','sensor_type'
       )
    )
    or (p_camera_id is null and p_event_type <> 'system_offline')
  then
    raise exception 'NAXA security event payload rejected' using errcode = '22023';
  end if;

  if p_camera_id is not null and not exists (
    select 1 from public.naxa_security_cameras as camera
     where camera.id = p_camera_id
       and camera.pharmacie_id = p_pharmacie_id
       and camera.gateway_id = p_gateway_id
       and camera.status not in ('disabled','retired')
  ) then
    raise exception 'NAXA security event camera is outside gateway scope'
      using errcode = '42501';
  end if;

  -- The server derives severity; a gateway cannot force a critical alert.
  v_severity := case
    when p_event_type in ('intrusion','line_crossing','camera_tamper') then 'high'
    when p_event_type in ('camera_obstructed','signal_lost','system_offline','after_hours_presence') then 'warning'
    else 'info'
  end;

  insert into public.naxa_security_events (
    pharmacie_id, gateway_id, camera_id, event_type, source_type,
    severity, status, summary, confidence, detected_at,
    source_fingerprint, event_metadata
  ) values (
    p_pharmacie_id, p_gateway_id, p_camera_id, p_event_type, p_source_type,
    v_severity, 'new', v_summary, p_confidence, p_detected_at,
    p_source_fingerprint, v_metadata
  )
  on conflict (gateway_id, source_fingerprint)
    where source_fingerprint is not null
  do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select event.id into v_event_id
      from public.naxa_security_events as event
     where event.gateway_id = p_gateway_id
       and event.source_fingerprint = p_source_fingerprint
     limit 1;
    if v_event_id is null then
      raise exception 'NAXA security event deduplication failed' using errcode = '40001';
    end if;
    return v_event_id;
  end if;

  insert into public.naxa_security_access_audit (
    pharmacie_id, actor_id, actor_role, action,
    resource_type, resource_id, justification, audit_metadata
  ) values (
    p_pharmacie_id, null, 'system', 'device_update',
    'event', v_event_id, 'Événement caméra reçu depuis une passerelle enrôlée',
    pg_catalog.jsonb_build_object(
      'gateway_id', p_gateway_id, 'camera_id', p_camera_id,
      'event_type', p_event_type, 'source_type', p_source_type,
      'severity', v_severity, 'source_fingerprint', p_source_fingerprint
    )
  );
  return v_event_id;
end;
$function$;

create or replace function public.naxa_security_review_security_event(
  p_event_id uuid, p_pharmacie_id uuid, p_reviewer_id uuid,
  p_decision text, p_review_note text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_event public.naxa_security_events%rowtype;
  v_note text := nullif(pg_catalog.btrim(coalesce(p_review_note, '')), '');
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_action text;
begin
  if p_event_id is null or p_pharmacie_id is null or p_reviewer_id is null
    or p_decision is null
    or p_decision not in ('acknowledged','in_review','false_positive','confirmed','closed')
    or (v_note is not null and (
      pg_catalog.length(v_note) > 500 or v_note ~ '[[:cntrl:]]'
    ))
  then
    raise exception 'NAXA security event review arguments rejected' using errcode = '22023';
  end if;

  select * into v_event
    from public.naxa_security_events
   where id = p_event_id and pharmacie_id = p_pharmacie_id
   for update;

  if not found then
    raise exception 'NAXA security event not found in pharmacy scope' using errcode = '42501';
  end if;
  if v_event.status in ('closed','false_positive')
    or (v_event.status = 'confirmed' and p_decision <> 'closed')
    or (p_decision = 'in_review' and v_event.status not in ('new','acknowledged','in_review'))
  then
    raise exception 'NAXA security event transition rejected' using errcode = '55000';
  end if;

  update public.naxa_security_events
     set status = p_decision, reviewed_by = p_reviewer_id,
         reviewed_at = v_now, review_note = v_note
   where id = p_event_id and pharmacie_id = p_pharmacie_id;

  v_action := case when p_decision = 'acknowledged'
    then 'event_acknowledge' else 'event_review' end;

  insert into public.naxa_security_access_audit (
    pharmacie_id, actor_id, actor_role, action,
    resource_type, resource_id, justification, audit_metadata
  ) values (
    p_pharmacie_id, p_reviewer_id, 'promoteur', v_action,
    'event', p_event_id, coalesce(v_note, 'Revue humaine de l’événement'),
    pg_catalog.jsonb_build_object(
      'previous_status', v_event.status,
      'new_status', p_decision,
      'event_type', v_event.event_type
    )
  );
  return p_decision;
end;
$function$;

revoke all on function public.naxa_security_ingest_gateway_event(
  uuid,uuid,uuid,text,text,text,numeric,timestamptz,text,jsonb
) from public, anon, authenticated;
grant execute on function public.naxa_security_ingest_gateway_event(
  uuid,uuid,uuid,text,text,text,numeric,timestamptz,text,jsonb
) to service_role;

revoke all on function public.naxa_security_review_security_event(
  uuid,uuid,uuid,text,text
) from public, anon, authenticated;
grant execute on function public.naxa_security_review_security_event(
  uuid,uuid,uuid,text,text
) to service_role;

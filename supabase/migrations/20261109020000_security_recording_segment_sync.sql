-- NAXA Security — lot 13 : synchronisation idempotente de métadonnées d'enregistrement local.
begin;

alter table public.naxa_security_access_audit
  drop constraint if exists naxa_security_access_audit_action_check;
alter table public.naxa_security_access_audit
  add constraint naxa_security_access_audit_action_check
  check (action in (
    'camera_live_view','clip_view','clip_export',
    'recording_segment_view','recording_segment_export','recording_segment_delete',
    'recording_policy_update','recording_segment_sync',
    'event_acknowledge','event_review','siren_request','siren_confirm','siren_stop',
    'device_read','device_update'
  ));

create or replace function public.naxa_security_sync_recording_segments(
  p_pharmacie_id uuid,
  p_gateway_id uuid,
  p_segments jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_inserted integer := 0;
  v_submitted integer;
begin
  if p_pharmacie_id is null or p_gateway_id is null or
     p_segments is null or pg_catalog.jsonb_typeof(p_segments) <> 'array' then
    raise exception using errcode = '22023', message = 'Invalid recording segment batch';
  end if;

  v_submitted := pg_catalog.jsonb_array_length(p_segments);
  if v_submitted < 1 or v_submitted > 10 then
    raise exception using errcode = '22023', message = 'Recording segment batch size out of range';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(p_segments) as s(
      camera_id uuid,
      recording_mode text,
      started_at timestamptz,
      ended_at timestamptz,
      duration_seconds numeric,
      codec text,
      container_format text,
      storage_path text,
      size_bytes bigint,
      sha256 text,
      audio_enabled boolean,
      retention_until timestamptz
    )
    left join public.naxa_security_cameras c
      on c.id = s.camera_id
     and c.pharmacie_id = p_pharmacie_id
     and c.gateway_id = p_gateway_id
    where c.id is null
       or s.recording_mode not in ('continuous','scheduled','event')
       or s.started_at is null
       or s.ended_at is null
       or s.ended_at < s.started_at
       or s.duration_seconds is null
       or s.duration_seconds <= 0
       or s.duration_seconds > 960
       or s.codec is null
       or s.codec !~ '^[A-Za-z0-9_.-]{1,64}$'
       or s.container_format <> 'mp4'
       or s.storage_path is null
       or s.storage_path !~ (
         '^' || s.camera_id::text || '/' || s.camera_id::text || '_[0-9]{8}T[0-9]{6}[.]mp4$'
       )
       or s.size_bytes is null
       or s.size_bytes <= 0
       or s.sha256 is null
       or s.sha256 !~ '^[0-9a-f]{64}$'
       or s.audio_enabled is distinct from false
       or s.retention_until is null
       or s.retention_until < s.started_at
  ) then
    raise exception using errcode = '22023', message = 'Invalid or out-of-scope recording segment';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(p_segments) as s(
      camera_id uuid,
      storage_path text,
      sha256 text
    )
    join public.naxa_security_recording_segments existing
      on existing.camera_id = s.camera_id
     and existing.storage_path = s.storage_path
    where existing.sha256 is distinct from s.sha256
  ) then
    raise exception using errcode = '23505', message = 'Recording segment path already indexed with a different hash';
  end if;

  insert into public.naxa_security_recording_segments (
    pharmacie_id, gateway_id, camera_id, recording_mode, status,
    started_at, ended_at, duration_seconds, codec, container_format,
    storage_path, size_bytes, sha256, audio_enabled, retention_until
  )
  select
    p_pharmacie_id, p_gateway_id, s.camera_id, s.recording_mode, 'ready',
    s.started_at, s.ended_at, s.duration_seconds, s.codec, s.container_format,
    s.storage_path, s.size_bytes, s.sha256, false, s.retention_until
  from pg_catalog.jsonb_to_recordset(p_segments) as s(
    camera_id uuid,
    recording_mode text,
    started_at timestamptz,
    ended_at timestamptz,
    duration_seconds numeric,
    codec text,
    container_format text,
    storage_path text,
    size_bytes bigint,
    sha256 text,
    audio_enabled boolean,
    retention_until timestamptz
  )
  on conflict (camera_id, storage_path) do nothing;

  get diagnostics v_inserted = row_count;

  insert into public.naxa_security_access_audit (
    pharmacie_id, actor_id, actor_role, action, resource_type, resource_id,
    justification, audit_metadata
  ) values (
    p_pharmacie_id, null, 'system', 'recording_segment_sync', 'recording_segment', null,
    'Synchronisation signée des métadonnées locales par passerelle',
    pg_catalog.jsonb_build_object(
      'gateway_id', p_gateway_id,
      'submitted_segments', v_submitted,
      'inserted_segments', v_inserted
    )
  );

  return v_inserted;
end;
$function$;

revoke all on function public.naxa_security_sync_recording_segments(uuid,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.naxa_security_sync_recording_segments(uuid,uuid,jsonb)
  to service_role;

comment on function public.naxa_security_sync_recording_segments(uuid,uuid,jsonb) is
  'Synchronise de façon idempotente des métadonnées de segments locaux ; les octets vidéo ne quittent pas la passerelle.';

commit;

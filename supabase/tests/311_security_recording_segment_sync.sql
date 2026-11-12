-- NAXA Security lot 13 — contrat de synchronisation des métadonnées de segments.
begin;
select
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='naxa_security_sync_recording_segments'
      and p.proargtypes='2950 2950 3802'::oidvector
  ) as sync_rpc_exists,
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='naxa_security_sync_recording_segments'
      and not p.prosecdef
      and coalesce(p.proconfig @> array['search_path=""']::text[],false)
  ) as sync_rpc_invoker_locked_path,
  not has_function_privilege('anon',
    'public.naxa_security_sync_recording_segments(uuid,uuid,jsonb)','EXECUTE')
    and not has_function_privilege('authenticated',
    'public.naxa_security_sync_recording_segments(uuid,uuid,jsonb)','EXECUTE')
    and has_function_privilege('service_role',
    'public.naxa_security_sync_recording_segments(uuid,uuid,jsonb)','EXECUTE')
    as sync_rpc_backend_only,
  exists (
    select 1 from pg_constraint
    where conrelid='public.naxa_security_access_audit'::regclass
      and conname='naxa_security_access_audit_action_check'
      and pg_get_constraintdef(oid) like '%recording_segment_sync%'
  ) as sync_action_auditable,
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='naxa_security_sync_recording_segments'
      and position('ON CONFLICT (CAMERA_ID, STORAGE_PATH) DO NOTHING' in upper(pg_get_functiondef(p.oid)))>0
      and position('RECORDING_SEGMENT_SYNC' in upper(pg_get_functiondef(p.oid)))>0
      and position('COUNT(DISTINCT S.SHA256)' in upper(pg_get_functiondef(p.oid)))>0
  ) as sync_rpc_idempotent_conflict_checked_and_audited;

do $test$
declare
  v_rejected boolean := false;
begin
  begin
    perform public.naxa_security_sync_recording_segments(
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      '[]'::jsonb
    );
  exception when sqlstate '22023' then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Empty recording segment batch was not rejected';
  end if;
end;
$test$;

rollback;

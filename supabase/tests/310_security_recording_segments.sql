-- NAXA Security lot 13 — contrat SQL de l'index de segments locaux.
begin;
select
  exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='naxa_security_recording_segments'
  ) as recording_segment_table_exists,
  (select c.relrowsecurity and c.relforcerowsecurity
   from pg_class c where c.oid='public.naxa_security_recording_segments'::regclass)
    as recording_segments_rls_forced,
  not has_table_privilege('anon','public.naxa_security_recording_segments','SELECT')
    and not has_table_privilege('anon','public.naxa_security_recording_segments','INSERT')
    and not has_table_privilege('anon','public.naxa_security_recording_segments','UPDATE')
    and not has_table_privilege('anon','public.naxa_security_recording_segments','DELETE')
    and not has_table_privilege('authenticated','public.naxa_security_recording_segments','SELECT')
    and not has_table_privilege('authenticated','public.naxa_security_recording_segments','INSERT')
    and not has_table_privilege('authenticated','public.naxa_security_recording_segments','UPDATE')
    and not has_table_privilege('authenticated','public.naxa_security_recording_segments','DELETE')
    as browser_roles_have_no_direct_access,
  has_table_privilege('service_role','public.naxa_security_recording_segments','SELECT')
    and has_table_privilege('service_role','public.naxa_security_recording_segments','INSERT')
    and has_table_privilege('service_role','public.naxa_security_recording_segments','UPDATE')
    and has_table_privilege('service_role','public.naxa_security_recording_segments','DELETE')
    as backend_can_manage_recording_segments,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_recording_segments'::regclass
    and conname='naxa_security_recording_segments_gateway_fk')
    as segment_gateway_bound_to_same_pharmacy,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_recording_segments'::regclass
    and conname='naxa_security_recording_segments_camera_fk')
    as segment_camera_bound_to_same_pharmacy,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_recording_segments'::regclass
    and conname='naxa_security_recording_segments_camera_path_uk')
    as camera_storage_path_is_unique,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_recording_segments'::regclass
    and conname='naxa_security_recording_segments_audio_enabled_check')
    as audio_is_forbidden,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_recording_segments'::regclass
    and conname='naxa_security_recording_segments_state_ck')
    as segment_state_machine_constraint_present,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_recording_segments'::regclass
    and conname='naxa_security_recording_segments_ready_metadata_ck')
    as ready_requires_hash_duration_codec_and_size,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_recording_segments'::regclass
    and conname='naxa_security_recording_segments_protected_ck')
    as protected_segments_require_reason_and_time,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_access_audit'::regclass
    and conname='naxa_security_access_audit_action_check'
    and pg_get_constraintdef(oid) like '%recording_segment_export%')
    as archive_actions_are_auditable,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_access_audit'::regclass
    and conname='naxa_security_access_audit_resource_type_check'
    and pg_get_constraintdef(oid) like '%recording_segment%')
    as archive_resource_is_auditable,
  exists (select 1 from pg_indexes where schemaname='public'
    and indexname='naxa_security_recording_segments_camera_time_idx')
    as camera_timeline_index_present,
  exists (select 1 from pg_indexes where schemaname='public'
    and indexname='naxa_security_recording_segments_pharmacy_time_idx')
    as pharmacy_timeline_index_present,
  exists (select 1 from pg_indexes where schemaname='public'
    and indexname='naxa_security_recording_segments_retention_idx')
    as retention_index_present;
rollback;

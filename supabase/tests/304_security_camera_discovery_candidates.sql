-- NAXA — contrat SQL de réception des découvertes ONVIF.
begin;
select
  (select count(*) = 1
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'naxa_security_camera_discovery_candidates'
     and c.relrowsecurity and c.relforcerowsecurity)
    as discovery_candidates_table_rls_forced,
  not has_table_privilege('anon','public.naxa_security_camera_discovery_candidates','SELECT')
    and not has_table_privilege('authenticated','public.naxa_security_camera_discovery_candidates','SELECT')
    as browser_roles_cannot_read_discovery_candidates,
  has_table_privilege('service_role','public.naxa_security_camera_discovery_candidates','INSERT')
    and has_table_privilege('service_role','public.naxa_security_camera_discovery_candidates','UPDATE')
    and has_table_privilege('service_role','public.naxa_security_camera_discovery_candidates','SELECT')
    as backend_can_manage_discovery_candidates,
  exists (select 1 from pg_indexes where schemaname='public'
    and indexname='naxa_security_discovery_gateway_key_uk')
    as gateway_device_deduplication_index_present,
  exists (select 1 from pg_indexes where schemaname='public'
    and indexname='naxa_security_discovery_pharmacy_pending_idx')
    as pharmacy_pending_review_index_present,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_camera_discovery_candidates'::regclass
    and conname='naxa_security_discovery_gateway_fk')
    as candidate_must_belong_to_gateway_pharmacy,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_camera_discovery_candidates'::regclass
    and conname='naxa_security_discovery_camera_fk')
    as approved_camera_must_match_pharmacy,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_camera_discovery_candidates'::regclass
    and conname='naxa_security_discovery_review_state_ck')
    as human_review_required_for_final_state,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_camera_discovery_candidates'::regclass
    and conname='naxa_security_camera_discovery_candidates_source_address_check')
    as source_address_is_private_ipv4,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_camera_discovery_candidates'::regclass
    and conname='naxa_security_discovery_endpoint_array_ck')
    as endpoint_count_is_bounded;
rollback;

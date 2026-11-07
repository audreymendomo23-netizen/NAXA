-- NAXA — contrat SQL d'enrôlement des passerelles.
begin;
select
  (select count(*) = 2 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname in ('naxa_security_gateway_enrollments','naxa_security_gateway_request_nonces')
      and c.relrowsecurity and c.relforcerowsecurity) as gateway_pairing_tables_rls_forced,
  not has_table_privilege('anon','public.naxa_security_gateway_enrollments','SELECT')
    and not has_table_privilege('authenticated','public.naxa_security_gateway_enrollments','SELECT')
    and not has_table_privilege('anon','public.naxa_security_gateway_request_nonces','SELECT')
    and not has_table_privilege('authenticated','public.naxa_security_gateway_request_nonces','SELECT')
    as browser_roles_cannot_read_pairing_material,
  has_table_privilege('service_role','public.naxa_security_gateway_enrollments','INSERT')
    and has_table_privilege('service_role','public.naxa_security_gateway_enrollments','UPDATE')
    and has_table_privilege('service_role','public.naxa_security_gateway_request_nonces','INSERT')
    as backend_can_manage_gateway_identity,
  exists (select 1 from pg_indexes where schemaname='public'
    and indexname='naxa_security_gateway_one_pending_enrollment_idx') as one_pending_code_per_gateway,
  exists (select 1 from pg_indexes where schemaname='public'
    and indexname='naxa_security_gateway_one_active_key_idx') as one_active_public_key_per_gateway,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_gateway_enrollments'::regclass
    and conname='naxa_security_gateway_enrollment_key_pair_ck') as consumed_code_requires_public_key,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_gateway_request_nonces'::regclass
    and conname='naxa_security_gateway_nonce_expiry_ck') as nonce_lifetime_is_bounded,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_camera_connections'::regclass
    and conname='naxa_security_camera_connection_vault_reference_ck') as camera_secrets_require_vault_reference,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_camera_connections'::regclass
    and conname='naxa_security_camera_connection_metadata_no_secrets_ck') as connection_metadata_rejects_secret_keys,
  exists (select 1 from information_schema.columns where table_schema='public'
    and table_name='naxa_security_gateways' and column_name='agent_key_fingerprint')
    as gateway_stores_only_public_key_fingerprint;
rollback;

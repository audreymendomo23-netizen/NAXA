-- NAXA — contrat de compatibilité multi-marques et connecteurs caméra.
begin;
select
  (select count(*) >= 15 from public.naxa_security_camera_adapters) as adapter_catalogue_seeded,
  (select count(*) >= 8 from public.naxa_security_camera_adapters
    where protocol in ('onvif','rtsp','rtsps','https_api','vendor_sdk','nvr_channel','analog_encoder','cloud_api')) as protocol_families_available,
  exists (select 1 from public.naxa_security_camera_adapters where adapter_key='generic.onvif') as generic_onvif_adapter_exists,
  exists (select 1 from public.naxa_security_camera_adapters where adapter_key='generic.rtsp') as generic_rtsp_adapter_exists,
  exists (select 1 from public.naxa_security_camera_adapters where adapter_key='generic.nvr_onvif') as nvr_recorder_adapter_exists,
  exists (select 1 from public.naxa_security_camera_adapters where adapter_key='bridge.analog_encoder') as analog_encoder_adapter_exists,
  exists (select 1 from public.naxa_security_camera_adapters where adapter_key='vendor.hikvision.isapi') as vendor_adapter_hikvision_registered,
  exists (select 1 from public.naxa_security_camera_adapters where adapter_key='vendor.dahua.cgi') as vendor_adapter_dahua_registered,
  exists (select 1 from public.naxa_security_camera_adapters where adapter_key='vendor.axis.vapix') as vendor_adapter_axis_registered,
  (select count(*) = 2 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname in ('naxa_security_camera_adapters','naxa_security_camera_connections')
      and c.relrowsecurity and c.relforcerowsecurity) as connector_tables_rls_forced,
  not has_table_privilege('anon','public.naxa_security_camera_adapters','SELECT')
    and not has_table_privilege('authenticated','public.naxa_security_camera_adapters','SELECT')
    and not has_table_privilege('anon','public.naxa_security_camera_connections','SELECT')
    and not has_table_privilege('authenticated','public.naxa_security_camera_connections','SELECT')
    as browser_roles_cannot_read_connector_registry,
  has_table_privilege('service_role','public.naxa_security_camera_connections','INSERT')
    and has_table_privilege('service_role','public.naxa_security_camera_connections','SELECT')
    as backend_can_manage_connections,
  (select count(*) = 15 from public.naxa_security_camera_adapters where integration_status='design_only')
    as no_vendor_driver_misrepresented_as_validated,
  exists (select 1 from pg_indexes where schemaname='public' and indexname='naxa_security_camera_one_primary_connection_idx')
    as one_primary_connection_index_present,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_camera_connections'::regclass
    and conname='naxa_security_camera_connection_camera_fk')
    as connection_bound_to_camera_pharmacy,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_camera_connections'::regclass
    and conname='naxa_security_camera_connection_gateway_fk')
    as connection_bound_to_same_pharmacy_gateway;
rollback;

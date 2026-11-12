-- NAXA Sécurité intelligente — contrat SQL et séparation des accès.
begin;
select
  (select count(*) = 7 from information_schema.tables where table_schema='public' and table_name = any(array[
    'naxa_security_installations','naxa_security_gateways','naxa_security_cameras','naxa_security_events',
    'naxa_security_clips','naxa_security_siren_commands','naxa_security_access_audit'
  ])) as all_security_tables_exist,
  (select count(*) = 7 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname = any(array[
      'naxa_security_installations','naxa_security_gateways','naxa_security_cameras','naxa_security_events',
      'naxa_security_clips','naxa_security_siren_commands','naxa_security_access_audit'
    ]) and c.relrowsecurity and c.relforcerowsecurity) as rls_enabled_and_forced_on_all_tables,
  (select bool_and(
      not has_table_privilege('anon', format('public.%I',t),'SELECT')
      and not has_table_privilege('anon', format('public.%I',t),'INSERT')
      and not has_table_privilege('anon', format('public.%I',t),'UPDATE')
      and not has_table_privilege('anon', format('public.%I',t),'DELETE')
      and not has_table_privilege('authenticated', format('public.%I',t),'SELECT')
      and not has_table_privilege('authenticated', format('public.%I',t),'INSERT')
      and not has_table_privilege('authenticated', format('public.%I',t),'UPDATE')
      and not has_table_privilege('authenticated', format('public.%I',t),'DELETE')
    ) from unnest(array[
      'naxa_security_installations','naxa_security_gateways','naxa_security_cameras','naxa_security_events',
      'naxa_security_clips','naxa_security_siren_commands','naxa_security_access_audit'
    ]) t) as public_roles_have_no_table_access,
  (select bool_and(
      has_table_privilege('service_role', format('public.%I',t),'SELECT')
      and has_table_privilege('service_role', format('public.%I',t),'INSERT')
      and has_table_privilege('service_role', format('public.%I',t),'UPDATE')
    ) from unnest(array[
      'naxa_security_installations','naxa_security_gateways','naxa_security_cameras','naxa_security_events',
      'naxa_security_clips','naxa_security_siren_commands','naxa_security_access_audit'
    ]) t) as backend_service_role_has_required_access,
  exists (select 1 from pg_trigger where tgrelid='public.naxa_security_access_audit'::regclass
    and tgname='naxa_security_access_audit_immutable_trg' and not tgisinternal) as audit_append_only,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_events'::regclass
    and conname='naxa_security_events_human_review_ck') as event_final_status_requires_human_review,
  exists (select 1 from pg_constraint where conrelid='public.naxa_security_siren_commands'::regclass
    and conname='naxa_security_siren_confirmation_ck') as siren_commands_require_human_confirmation,
  not has_function_privilege('anon','public.naxa_security_audit_reject_mutation()','EXECUTE') as audit_trigger_fn_not_public_api,
  not exists (select 1 from information_schema.columns where table_schema='public' and table_name=any(array[
    'naxa_security_installations','naxa_security_gateways','naxa_security_cameras','naxa_security_events',
    'naxa_security_clips','naxa_security_siren_commands','naxa_security_access_audit'
  ]) and column_name in ('rtsp_url','onvif_url','stream_url','public_url','camera_password','password'))
  as no_public_stream_or_password_fields;
rollback;

-- NAXA — géolocalisation propre à chaque pharmacie, provenance et journal privé.
begin;

select
  (
    select count(*) = 3
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pharmacies'
      and column_name in ('geo_source_type', 'geo_verifiee_par', 'geo_verifiee_le')
  ) as pharmacy_geo_metadata_columns_ok,
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'naxa_pharmacie_geo_audit'
      and c.relrowsecurity is true
      and c.relforcerowsecurity is true
  ) as private_geo_audit_rls_forced,
  not has_table_privilege('anon', 'public.naxa_pharmacie_geo_audit', 'SELECT')
    as anon_cannot_read_geo_audit,
  not has_table_privilege('authenticated', 'public.naxa_pharmacie_geo_audit', 'SELECT')
    as authenticated_cannot_read_geo_audit,
  has_table_privilege('service_role', 'public.naxa_pharmacie_geo_audit', 'INSERT')
    as backend_can_write_geo_audit,
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.pharmacies'::regclass
      and conname = 'pharmacies_geo_statut_ck'
      and pg_get_constraintdef(oid) ilike '%a_verifier%'
  ) as pending_geo_status_is_allowed;

rollback;

-- NAXA — contrat SQL de la revue atomique des candidats ONVIF.
begin;
select
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'naxa_security_review_discovery_candidate'
      and p.proargtypes = '2950 25 25 2950'::oidvector
  ) as atomic_review_function_present,
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'naxa_security_review_discovery_candidate'
      and p.prosecdef
      and coalesce(p.proconfig @> array['search_path=""']::text[], false)
  ) as atomic_review_uses_locked_definer_context,
  not has_function_privilege(
    'anon',
    'public.naxa_security_review_discovery_candidate(uuid,text,text,uuid)'::regprocedure,
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.naxa_security_review_discovery_candidate(uuid,text,text,uuid)'::regprocedure,
    'EXECUTE'
  ) as browser_roles_cannot_execute_atomic_review,
  has_function_privilege(
    'service_role',
    'public.naxa_security_review_discovery_candidate(uuid,text,text,uuid)'::regprocedure,
    'EXECUTE'
  ) as backend_can_execute_atomic_review,
  (
    select position('FOR UPDATE' in upper(pg_get_functiondef(p.oid))) > 0
       and position('NAXA_SECURITY_ACCESS_AUDIT' in upper(pg_get_functiondef(p.oid))) > 0
       and position('ON CONFLICT' in upper(pg_get_functiondef(p.oid))) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'naxa_security_review_discovery_candidate'
  ) as atomic_review_locks_writes_and_audits,
  (
    select position('CONNECTION_STATUS' in upper(pg_get_functiondef(p.oid))) > 0
       and position('DISCOVERED' in upper(pg_get_functiondef(p.oid))) > 0
       and position('CONNECTED' in upper(pg_get_functiondef(p.oid))) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'naxa_security_review_discovery_candidate'
  ) as accepted_camera_never_claims_live_connectivity;
rollback;

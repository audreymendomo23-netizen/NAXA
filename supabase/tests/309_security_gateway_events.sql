begin;
select
  (select relrowsecurity and relforcerowsecurity
     from pg_class where oid='public.naxa_security_events'::regclass) as events_rls_forced,
  not has_table_privilege('anon','public.naxa_security_events','select')
    and not has_table_privilege('authenticated','public.naxa_security_events','select')
    as events_not_browser_readable,
  exists (select 1 from pg_indexes
    where schemaname='public' and indexname='naxa_security_events_gateway_fingerprint_uidx'
      and indexdef ilike '%unique%') as gateway_fingerprint_unique,
  not has_function_privilege('anon',
    'public.naxa_security_ingest_gateway_event(uuid,uuid,uuid,text,text,text,numeric,timestamp with time zone,text,jsonb)'::regprocedure,'EXECUTE')
    and not has_function_privilege('authenticated',
    'public.naxa_security_ingest_gateway_event(uuid,uuid,uuid,text,text,text,numeric,timestamp with time zone,text,jsonb)'::regprocedure,'EXECUTE')
    and has_function_privilege('service_role',
    'public.naxa_security_ingest_gateway_event(uuid,uuid,uuid,text,text,text,numeric,timestamp with time zone,text,jsonb)'::regprocedure,'EXECUTE')
    as event_ingest_rpc_server_only,
  not has_function_privilege('anon',
    'public.naxa_security_review_security_event(uuid,uuid,uuid,text,text)'::regprocedure,'EXECUTE')
    and not has_function_privilege('authenticated',
    'public.naxa_security_review_security_event(uuid,uuid,uuid,text,text)'::regprocedure,'EXECUTE')
    and has_function_privilege('service_role',
    'public.naxa_security_review_security_event(uuid,uuid,uuid,text,text)'::regprocedure,'EXECUTE')
    as event_review_rpc_server_only,
  (select prosecdef=false and coalesce(proconfig @> array['search_path=""']::text[],false)
     from pg_proc where oid='public.naxa_security_ingest_gateway_event(uuid,uuid,uuid,text,text,text,numeric,timestamp with time zone,text,jsonb)'::regprocedure)
    as event_ingest_invoker_locked,
  (select prosecdef=false and coalesce(proconfig @> array['search_path=""']::text[],false)
     from pg_proc where oid='public.naxa_security_review_security_event(uuid,uuid,uuid,text,text)'::regprocedure)
    as event_review_invoker_locked;
rollback;

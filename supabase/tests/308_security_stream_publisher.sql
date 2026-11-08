begin;
select
  (select relrowsecurity and relforcerowsecurity from pg_class
   where oid = 'public.naxa_security_stream_publish_tickets'::regclass)
    as publisher_ticket_rls_enabled_and_forced,
  not has_table_privilege('anon','public.naxa_security_stream_publish_tickets','select')
    and not has_table_privilege('authenticated','public.naxa_security_stream_publish_tickets','select')
    and has_table_privilege('service_role','public.naxa_security_stream_publish_tickets','select')
    as publisher_ticket_acl_server_only,
  not has_function_privilege('anon',
    'public.naxa_security_issue_stream_publish_ticket(uuid,uuid,uuid,text,text,timestamp with time zone)'::regprocedure,'EXECUTE')
    and not has_function_privilege('authenticated',
    'public.naxa_security_issue_stream_publish_ticket(uuid,uuid,uuid,text,text,timestamp with time zone)'::regprocedure,'EXECUTE')
    and has_function_privilege('service_role',
    'public.naxa_security_issue_stream_publish_ticket(uuid,uuid,uuid,text,text,timestamp with time zone)'::regprocedure,'EXECUTE')
    as publisher_ticket_rpc_server_only,
  (select prosecdef = false and coalesce(proconfig @> array['search_path=""']::text[],false)
   from pg_proc where oid = 'public.naxa_security_issue_stream_publish_ticket(uuid,uuid,uuid,text,text,timestamp with time zone)'::regprocedure)
    as publisher_ticket_rpc_invoker_empty_search_path,
  (select prosecdef = false and coalesce(proconfig @> array['search_path=""']::text[],false)
   from pg_proc where oid = 'public.naxa_security_report_stream_health(uuid,uuid,uuid,text,bigint)'::regprocedure)
    as stream_health_rpc_invoker_empty_search_path;
rollback;

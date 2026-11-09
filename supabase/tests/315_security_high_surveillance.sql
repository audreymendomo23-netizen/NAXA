begin;
select
 to_regclass('public.naxa_security_high_surveillance_policies') is not null as policy_table_exists,
 exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='naxa_security_high_surveillance_policies' and c.relrowsecurity and c.relforcerowsecurity) as policy_rls_forced,
 exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='naxa_security_save_high_surveillance_policy' and not p.prosecdef and coalesce(p.proconfig @> array['search_path=""']::text[],false)) as save_rpc_invoker_locked,
 not has_function_privilege('anon','public.naxa_security_save_high_surveillance_policy(uuid,uuid,boolean,text,jsonb,jsonb,timestamptz)','EXECUTE')
 and not has_function_privilege('authenticated','public.naxa_security_save_high_surveillance_policy(uuid,uuid,boolean,text,jsonb,jsonb,timestamptz)','EXECUTE')
 and has_function_privilege('service_role','public.naxa_security_save_high_surveillance_policy(uuid,uuid,boolean,text,jsonb,jsonb,timestamptz)','EXECUTE') as save_rpc_backend_only,
 exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relname='naxa_security_events' and t.tgname='naxa_security_high_surveillance_event_priority' and not t.tgisinternal) as priority_trigger_exists,
 to_regprocedure('public.naxa_security_is_high_surveillance(uuid,timestamptz)') is not null as evaluator_exists;
rollback;
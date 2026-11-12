-- NAXA Security lot 14.
begin;
select
 to_regclass('public.naxa_security_gateway_time_samples') is not null as time_samples_table_exists,
 exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='naxa_security_gateway_time_samples' and c.relrowsecurity and c.relforcerowsecurity) as time_samples_rls_forced,
 exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='naxa_security_record_gateway_time_sample' and not p.prosecdef and coalesce(p.proconfig @> array['search_path=""']::text[],false)) as time_rpc_invoker_locked_path,
 not has_function_privilege('anon','public.naxa_security_record_gateway_time_sample(uuid,uuid,text,smallint,bigint,integer,text,timestamptz)','EXECUTE')
 and not has_function_privilege('authenticated','public.naxa_security_record_gateway_time_sample(uuid,uuid,text,smallint,bigint,integer,text,timestamptz)','EXECUTE')
 and has_function_privilege('service_role','public.naxa_security_record_gateway_time_sample(uuid,uuid,text,smallint,bigint,integer,text,timestamptz)','EXECUTE') as time_rpc_backend_only,
 exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='naxa_security_record_gateway_time_sample' and position('FOR UPDATE' in upper(pg_get_functiondef(p.oid)))>0 and position('NAXA_SECURITY_ACCESS_AUDIT' in upper(pg_get_functiondef(p.oid)))>0) as time_sample_atomic_audited;
rollback;

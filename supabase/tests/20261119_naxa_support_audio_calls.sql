begin;
do $test$
declare v_count integer; v_definition text;
begin
 if to_regclass('public.support_calls') is null or to_regclass('public.support_call_events') is null then raise exception 'Tables d’appels absentes'; end if;
 if not (select relrowsecurity from pg_class where oid='public.support_calls'::regclass)
 or not (select relrowsecurity from pg_class where oid='public.support_call_events'::regclass) then raise exception 'RLS absent'; end if;
 if has_table_privilege('service_role','public.support_call_events','INSERT')
 or has_table_privilege('service_role','public.support_call_events','UPDATE')
 or has_table_privilege('service_role','public.support_call_events','DELETE')
 or has_table_privilege('service_role','public.support_calls','INSERT')
 or has_table_privilege('service_role','public.support_calls','UPDATE')
 or has_table_privilege('service_role','public.support_calls','DELETE')
 or not has_table_privilege('service_role','public.support_call_events','SELECT')
 or not has_table_privilege('service_role','public.support_calls','SELECT') then
 raise exception 'service_role doit être limité à SELECT sur les tables d’appel'; end if;
 if has_table_privilege('authenticated','public.support_calls','INSERT') or has_table_privilege('authenticated','public.support_calls','UPDATE')
 or has_table_privilege('authenticated','public.support_calls','DELETE') or has_table_privilege('authenticated','public.support_call_events','SELECT')
 then raise exception 'Privilège authenticated excessif'; end if;
 select count(*) into v_count from pg_policies where schemaname='realtime' and tablename='messages'
 and policyname in ('naxa_support_call_broadcast_read','naxa_support_call_broadcast_write');
 if v_count<>2 then raise exception 'Policies Realtime privées incomplètes'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='support_call_events'
   and policyname='support_call_events_deny_client_read'
   and roles @> array['authenticated']::name[] and qual='false') then
   raise exception 'Lecture directe des événements non refusée explicitement'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='naxa_support_call_request'
 and has_function_privilege('service_role',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE'))
 then raise exception 'RPC request non réservée au backend'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public' and indexname='support_calls_one_active_per_ticket_uq') then raise exception 'Unicité ticket absente'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='support_calls' and column_name='requester_heartbeat_at')
 or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='support_calls' and column_name='agent_heartbeat_at')
 or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='support_calls' and column_name='queue_expires_at') then
   raise exception 'Colonnes heartbeat/expiration absentes'; end if;
 if to_regprocedure('public.naxa_support_call_heartbeat(uuid,uuid)') is null
 or to_regprocedure('private.naxa_support_call_reap_expired()') is null then
   raise exception 'RPC heartbeat ou reaper absent'; end if;
 if not exists(select 1 from cron.job where jobname='naxa-support-call-reaper' and schedule='* * * * *') then
   raise exception 'Expiration cron des appels absente'; end if;
 if position('80 seconds' in lower(pg_get_functiondef('public.naxa_support_call_request(uuid,uuid)'::regprocedure)))=0
 or position('60 seconds' in lower(pg_get_functiondef('public.naxa_support_call_request(uuid,uuid)'::regprocedure)))=0 then
   raise exception 'Délais de routage assigné/central non conformes'; end if;
 if position('120 seconds' in lower(pg_get_functiondef('private.naxa_support_call_reap_expired()'::regprocedure)))=0 then
   raise exception 'Lease session heartbeat non configurée'; end if;
 if has_function_privilege('authenticated','public.naxa_support_call_heartbeat(uuid,uuid)','EXECUTE') then
   raise exception 'RPC heartbeat accessible directement au client'; end if;

 if not exists(select 1 from pg_trigger where tgname='trg_naxa_support_call_event_immutable' and not tgisinternal)
 then raise exception 'Journal append-only absent'; end if;
 if not exists(select 1 from pg_trigger where tgname='trg_naxa_support_agent_end_calls' and not tgisinternal)
 or not exists(select 1 from pg_trigger where tgname='trg_naxa_support_agent_permission_end_calls' and not tgisinternal)
 or not exists(select 1 from pg_trigger where tgname='trg_naxa_support_ticket_end_calls' and not tgisinternal)
 or not exists(select 1 from pg_trigger where tgname='trg_naxa_support_profile_end_calls' and not tgisinternal)
 then raise exception 'Garde de fin automatique absente'; end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name in ('support_calls','support_call_events')
 and (column_name ilike '%sdp%' or column_name ilike '%candidate%' or column_name ilike '%recording%')) then raise exception 'Média ou signalisation persisté'; end if;
 select pg_get_functiondef('private.naxa_support_call_realtime_access(text,uuid)'::regprocedure) into v_definition;
 if position('auth.uid()' in v_definition)=0 or position('status=''accepted''' in lower(v_definition))=0
 or position('requester_profile.actif' in v_definition)=0 or position('resolu' in v_definition)=0
 or position('ticket_view_assigned' in v_definition)=0 or position('audio_call' in v_definition)=0 then raise exception 'RLS Realtime ne limite pas aux participants'; end if;
 select pg_get_functiondef('public.naxa_support_call_accept(uuid,uuid)'::regprocedure) into v_definition;
 if position('queue_view' in v_definition)=0 then raise exception 'Prise de file centrale non protégée'; end if;
 if position('for update of sa skip locked' in lower(pg_get_functiondef('public.naxa_support_call_request(uuid,uuid)'::regprocedure)))=0 then
   raise exception 'Routage Agent non sérialisé'; end if;
 if not exists(select 1 from pg_constraint where conrelid='public.support_calls'::regclass and conname='support_calls_requester_user_id_fkey' and confdeltype='n')
 or not exists(select 1 from pg_constraint where conrelid='public.support_calls'::regclass and conname='support_calls_ticket_id_fkey' and confdeltype='n') then
   raise exception 'Suppression des références audit non résiliente'; end if;
end; $test$;
rollback;

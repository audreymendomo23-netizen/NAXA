-- Comptable service attendance: structural security contract.
do $test$
declare
  v_rls boolean;
  v_policy text;
  v_start text;
  v_end text;
begin
  select c.relrowsecurity into v_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='comptable_service_sessions';
  if v_rls is distinct from true then raise exception 'FAIL: RLS not enabled'; end if;

  select pg_get_expr(polqual,polrelid) into v_policy
  from pg_policy where polrelid='public.comptable_service_sessions'::regclass
    and polname='comptable_service_sessions_select_self';
  if v_policy is null or position('auth.uid' in v_policy)=0
     or position('compta_scope_autorise' in v_policy)=0 then
    raise exception 'FAIL: SELECT policy does not enforce identity and accounting scope';
  end if;

  if has_table_privilege('authenticated','public.comptable_service_sessions','INSERT')
     or has_table_privilege('authenticated','public.comptable_service_sessions','UPDATE')
     or has_table_privilege('authenticated','public.comptable_service_sessions','DELETE') then
    raise exception 'FAIL: authenticated has direct write privileges';
  end if;
  if not has_table_privilege('authenticated','public.comptable_service_sessions','SELECT') then
    raise exception 'FAIL: authenticated SELECT grant missing';
  end if;
  if has_function_privilege('anon','public.comptable_service_demarrer(text)','EXECUTE')
     or has_function_privilege('anon','public.comptable_service_terminer(uuid,text)','EXECUTE') then
    raise exception 'FAIL: anon can execute service RPCs';
  end if;
  if not has_function_privilege('authenticated','public.comptable_service_demarrer(text)','EXECUTE')
     or not has_function_privilege('authenticated','public.comptable_service_terminer(uuid,text)','EXECUTE') then
    raise exception 'FAIL: authenticated RPC grants missing';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='comptable_service_one_open_session_per_user_uidx' and indexdef ilike '%WHERE (ended_at IS NULL)%') then
    raise exception 'FAIL: one-open-session unique index missing';
  end if;
  select pg_get_functiondef('public.comptable_service_demarrer(text)'::regprocedure) into v_start;
  select pg_get_functiondef('public.comptable_service_terminer(uuid,text)'::regprocedure) into v_end;
  if position('compta_scope_autorise' in v_start)=0 or position('compta_scope_autorise' in v_end)=0
     or position('auth.uid' in v_start)=0 or position('auth.uid' in v_end)=0 then
    raise exception 'FAIL: RPCs do not enforce identity and scope';
  end if;
end
$test$;

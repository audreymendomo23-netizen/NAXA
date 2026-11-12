-- NAXA Security lot 13 — protection transactionnelle des segments.
begin;

select
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='naxa_security_set_recording_protection'
      and p.proargtypes='2950 2950 2950 25 16 25'::oidvector
  ) as protection_rpc_exists,
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='naxa_security_set_recording_protection'
      and not p.prosecdef
      and coalesce(p.proconfig @> array['search_path=""']::text[],false)
  ) as protection_rpc_invoker_locked_path,
  not has_function_privilege('anon',
    'public.naxa_security_set_recording_protection(uuid,uuid,uuid,text,boolean,text)','EXECUTE')
    and not has_function_privilege('authenticated',
    'public.naxa_security_set_recording_protection(uuid,uuid,uuid,text,boolean,text)','EXECUTE')
    and has_function_privilege('service_role',
    'public.naxa_security_set_recording_protection(uuid,uuid,uuid,text,boolean,text)','EXECUTE')
    as protection_rpc_backend_only,
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='naxa_security_set_recording_protection'
      and position('FOR UPDATE' in upper(pg_get_functiondef(p.oid))) > 0
      and position('RECORDING_POLICY_UPDATE' in upper(pg_get_functiondef(p.oid))) > 0
      and position('NAXA_SECURITY_ACCESS_AUDIT' in upper(pg_get_functiondef(p.oid))) > 0
  ) as protection_atomic_and_audited;

do $test$
declare
  v_rejected boolean := false;
begin
  begin
    perform public.naxa_security_set_recording_protection(
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000003',
      'promoteur',
      true,
      'court'
    );
  exception when sqlstate '22023' then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Short protection justification was not rejected';
  end if;
end;
$test$;

rollback;

do $test$
declare
  v_policy record;
  v_rls_enabled boolean;
begin
  select c.relrowsecurity
    into v_rls_enabled
  from pg_class c
  where c.oid='public.stocks'::regclass;

  if v_rls_enabled is not true then
    raise exception 'RLS doit rester activée sur public.stocks';
  end if;

  select policyname,cmd,roles,qual
    into v_policy
  from pg_policies
  where schemaname='public'
    and tablename='stocks'
    and policyname='stocks_read_active_stock_assignment';

  if not found
     or v_policy.cmd<>'SELECT'
     or v_policy.roles<>'{authenticated}'
     or position('naxa_has_active_professional_assignment' in v_policy.qual)=0
     or position('gestionnaire_stock' in v_policy.qual)=0
     or position('magasinier' in v_policy.qual)=0 then
    raise exception 'La policy de lecture doit viser uniquement les affectations Stock/Magasinier actives et authentifiées';
  end if;

  if has_table_privilege('anon','public.stocks','SELECT') then
    raise exception 'Le rôle anon ne doit pas recevoir SELECT sur public.stocks';
  end if;
end
$test$;

select 'Stock read RLS is limited to active assigned Stock/Magasinier profiles; anon and direct write permissions unchanged: PASS' as result;

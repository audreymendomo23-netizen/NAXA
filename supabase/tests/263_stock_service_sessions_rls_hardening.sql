-- NAXA 263 — focused structural security test for stock service attendance.
do $test$
begin
  if to_regclass('public.stock_service_sessions') is null
     or to_regclass('public.stock_service_inventory_counts') is null then
    raise exception 'NAXA 263: stock service tables are absent';
  end if;
  if not exists (
    select 1 from pg_tables
    where schemaname='public' and tablename='stock_service_sessions' and rowsecurity
  ) or not exists (
    select 1 from pg_tables
    where schemaname='public' and tablename='stock_service_inventory_counts' and rowsecurity
  ) then
    raise exception 'NAXA 263: RLS is not enabled on both stock service tables';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='stock_service_sessions'
      and policyname='stock_service_sessions_read_scope' and cmd='SELECT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='stock_service_inventory_counts'
      and policyname='stock_service_counts_read_scope' and cmd='SELECT'
  ) then
    raise exception 'NAXA 263: scoped SELECT policies are missing';
  end if;
  if not has_table_privilege('authenticated','public.stock_service_sessions','SELECT')
     or has_table_privilege('authenticated','public.stock_service_sessions','INSERT')
     or has_table_privilege('authenticated','public.stock_service_sessions','UPDATE')
     or has_table_privilege('authenticated','public.stock_service_sessions','DELETE') then
    raise exception 'NAXA 263: stock service table privileges are not read-only for authenticated users';
  end if;
end;
$test$;
select true as naxa_263_stock_service_sessions_rls_pass;

-- Test structurel de la RPC reçus : signature limitée et privilèges contrôlés.
begin;
do $$
declare
  v_result record;
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='compta_lire_recus_abonnement'
      and pg_get_function_result(p.oid) ilike '%reference text%'
      and pg_get_function_result(p.oid) not ilike '%telephone%'
      and pg_get_function_result(p.oid) not ilike '%mobile%'
  ) then
    raise exception 'FAIL: signature de reçus absente ou trop large';
  end if;
  if has_function_privilege('anon','public.compta_lire_recus_abonnement(date,date)','EXECUTE') then
    raise exception 'FAIL: anon peut appeler la RPC reçus';
  end if;
  if not has_function_privilege('authenticated','public.compta_lire_recus_abonnement(date,date)','EXECUTE') then
    raise exception 'FAIL: authenticated ne peut pas appeler la RPC reçus';
  end if;
end $$;
select 'PASS 166_compta_recus_abonnement_rpc' as result;
rollback;

-- NAXA 124 — assertions structurelles des droits prestations à domicile.
do $test$
declare
  request_policy text;
  address_policy text;
  transition_def text;
  result_count integer := 0;
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='home_service_requests' and c.relrowsecurity
  ) then raise exception 'home_service_requests RLS must be enabled'; end if;
  result_count := result_count + 1;

  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='home_service_request_addresses' and c.relrowsecurity
  ) then raise exception 'home_service_request_addresses RLS must be enabled'; end if;
  result_count := result_count + 1;

  select qual into request_policy from pg_policies
  where schemaname='public' and tablename='home_service_requests'
    and policyname='home_service_requests_partner_read' and cmd='SELECT';
  if request_policy is null
     or position('professionnel_domicile' in request_policy)=0
     or position('active' in request_policy)=0
     or position('auth.uid()' in request_policy)=0 then
    raise exception 'Partner request read policy is not scoped to active home-service partners';
  end if;
  result_count := result_count + 1;

  select qual into address_policy from pg_policies
  where schemaname='public' and tablename='home_service_request_addresses'
    and policyname='home_service_request_addresses_confirmed_partner_read' and cmd='SELECT';
  if address_policy is null
     or position('professionnel_domicile' in address_policy)=0
     or position('confirmed' in address_policy)=0
     or position('completed' in address_policy)=0 then
    raise exception 'Private address policy must require an eligible partner and confirmed/completed request';
  end if;
  result_count := result_count + 1;

  select pg_get_functiondef('public.transition_home_service_request(uuid,text)'::regprocedure)
    into transition_def;
  if position('professionnel_domicile' in transition_def)=0 then
    raise exception 'Transition RPC must restrict partner type';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='transition_home_service_request'
      and p.proconfig @> array['search_path=public, pg_temp']
  ) then raise exception 'Transition RPC search_path must keep pg_temp last'; end if;
  result_count := result_count + 1;

  if has_function_privilege('anon','public.transition_home_service_request(uuid,text)','EXECUTE') then
    raise exception 'Anonymous users must not execute transition RPC';
  end if;
  if not has_function_privilege('authenticated','public.transition_home_service_request(uuid,text)','EXECUTE') then
    raise exception 'Authenticated users must execute transition RPC';
  end if;
  result_count := result_count + 1;

  if has_table_privilege('authenticated','public.home_service_request_addresses','INSERT')
     or has_table_privilege('authenticated','public.home_service_request_addresses','UPDATE')
     or has_table_privilege('authenticated','public.home_service_request_addresses','DELETE') then
    raise exception 'Direct writes to private address table must remain revoked';
  end if;
  result_count := result_count + 1;

  raise notice 'naxa_124_home_services_security_pass=true assertions=%', result_count;
end;
$test$;

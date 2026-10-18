-- Test structurel NAXA 120 : les RPC privilégiées de réservation placent pg_temp en dernier.
-- Lecture seule : aucune donnée métier modifiée.
do $test$
declare
  configured_path text[];
  function_name text;
  expected_functions text[] := array[
    'reserve_universe_products',
    'transition_universe_reservation'
  ];
begin
  foreach function_name in array expected_functions loop
    configured_path := null;

    select p.proconfig
      into configured_path
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
      and p.oid = case function_name
        when 'reserve_universe_products' then 'public.reserve_universe_products(uuid,text,jsonb,text)'::regprocedure
        when 'transition_universe_reservation' then 'public.transition_universe_reservation(uuid,text)'::regprocedure
      end;

    if configured_path is null then
      raise exception 'Fonction SECURITY DEFINER absente ou signature inattendue : %', function_name;
    end if;

    if not exists (
      select 1
      from unnest(configured_path) as cfg
      where regexp_replace(cfg, '\s+', '', 'g') = 'search_path=public,extensions,pg_temp'
    ) then
      raise exception 'search_path insuffisant pour % : %', function_name, configured_path;
    end if;
  end loop;
end;
$test$;

select true as naxa_120_universe_reservation_search_path_pass;

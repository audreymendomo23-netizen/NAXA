-- Test structurel NAXA 120 : les RPC privilégiées de réservation placent pg_temp en dernier.
-- Lecture seule : aucune donnée métier modifiée.
do $test$
declare
  fn record;
  configured_path text;
  expected_functions text[] := array[
    'reserve_universe_products',
    'transition_universe_reservation'
  ];
  function_name text;
begin
  foreach function_name in array expected_functions loop
    select p.proconfig
      into configured_path
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = function_name
      and p.prosecdef = true
      and (
        (function_name = 'reserve_universe_products'
          and pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_partner_id uuid, p_universe_slug text, p_items jsonb, p_note text')
        or
        (function_name = 'transition_universe_reservation'
          and pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_reservation_id uuid, p_status text')
      );

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

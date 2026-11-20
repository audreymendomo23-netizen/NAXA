-- Test NAXA B01 : le statut public agrège le registre et le flag sans exposer feature_flags.
do $test$
declare
  v_count integer;
  v_mismatch integer;
  v_security_definer boolean;
  v_config text[];
begin
  select count(*) into v_count
  from public.get_universe_public_status();
  if v_count <> 5 then
    raise exception 'B01: attendu 5 univers configurables, obtenu %', v_count;
  end if;

  select count(*) into v_mismatch
  from public.universes u
  join public.feature_flags f on f.flag_key = 'universe.' || u.slug
  left join public.get_universe_public_status() s on s.slug = u.slug
  where u.slug in ('parapharmacie','bebe-maman','examens','suivi','prestations')
    and (s.slug is null or s.enabled is distinct from (u.enabled is true and f.enabled is true));
  if v_mismatch <> 0 then
    raise exception 'B01: état public divergent du couple registre/feature flag (% écarts)', v_mismatch;
  end if;

  if not has_function_privilege('anon','public.get_universe_public_status()','EXECUTE') then
    raise exception 'B01: anon ne peut pas appeler la RPC publique';
  end if;
  if has_table_privilege('anon','public.feature_flags','SELECT') then
    raise exception 'B01: anon peut lire directement feature_flags';
  end if;

  select p.prosecdef, p.proconfig
    into v_security_definer, v_config
  from pg_proc p
  where p.oid = 'public.get_universe_public_status()'::regprocedure;
  if v_security_definer is not true or not ('search_path=""' = any(coalesce(v_config, array[]::text[]))) then
    raise exception 'B01: RPC doit être SECURITY DEFINER avec search_path vide';
  end if;
end;
$test$;

set role anon;
do $anon_test$
declare v_count integer;
begin
  select count(*) into v_count from public.get_universe_public_status();
  if v_count <> 5 then
    raise exception 'B01: exécution réelle sous rôle anon incorrecte';
  end if;
end;
$anon_test$;
reset role;

select true as naxa_b01_combined_universe_status_pass;

-- NAXA — test contradictoire : aucun provisioning automatique legacy
begin;

do $test$
declare
  trigger_count integer;
  public_exec boolean;
  auth_exec boolean;
begin
  select count(*) into trigger_count
  from pg_trigger
  where not tgisinternal
    and tgname in ('trg_naxa_provision_promoteur','trg_naxa_provision_on_architecture');

  if trigger_count <> 0 then
    raise exception 'PART4_FAIL_LEGACY_PROVISION_TRIGGERS_STILL_PRESENT';
  end if;

  select has_function_privilege('public','public.naxa_provision_promoteur_pharmacie(uuid,uuid)','EXECUTE')
    into public_exec;
  select has_function_privilege('authenticated','public.naxa_provision_promoteur_pharmacie(uuid,uuid)','EXECUTE')
    into auth_exec;

  if public_exec or auth_exec then
    raise exception 'PART4_FAIL_LEGACY_PROVISION_FUNCTION_STILL_EXPOSED';
  end if;

  raise notice 'PART4_LEGACY_PROVISIONING_GREEN';
end
$test$;

rollback;

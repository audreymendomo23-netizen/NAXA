-- MC-03 — contrat de synchronisation appareil à jeton.
-- Tests structurels sûrs : aucun jeu de données métier ni mutation de stock.
do $$
declare
  v_result jsonb;
begin
  if to_regclass('public.appareils') is null then
    raise exception 'MC-03: table appareils absente';
  end if;
  if to_regclass('public.offline_operations') is null then
    raise exception 'MC-03: table offline_operations absente';
  end if;
  if to_regprocedure('public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)') is null then
    raise exception 'MC-03: RPC de synchronisation appareil absente';
  end if;

  if has_function_privilege('anon',
    'public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)', 'EXECUTE') then
    raise exception 'MC-03: anon ne doit pas exécuter la RPC';
  end if;
  if has_function_privilege('authenticated',
    'public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)', 'EXECUTE') then
    raise exception 'MC-03: authenticated ne doit pas exécuter la RPC par jeton';
  end if;
  if not has_function_privilege('service_role',
    'public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)', 'EXECUTE') then
    raise exception 'MC-03: service_role doit exécuter la RPC';
  end if;

  v_result := public.naxa_apply_offline_operation_v1(
    '00000000-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-4000-8000-000000000002'::uuid,
    'stock_set_quantity',
    '{}'::jsonb,
    0
  );
  if v_result->>'status' is distinct from 'rejected'
     or v_result->>'reason' is distinct from 'device_inactive' then
    raise exception 'MC-03: un appareil inconnu doit être rejeté, reçu: %', v_result;
  end if;
end $$;

select '220_offline_device_sync_contract PASS' as resultat;

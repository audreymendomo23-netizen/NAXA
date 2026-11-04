begin;
do $test$
declare
  v_online text:=pg_get_functiondef('public.offline_stock_set_quantity(uuid,uuid,uuid,integer,timestamptz)'::regprocedure);
  v_offline text:=pg_get_functiondef('public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)'::regprocedure);
  v_permissions text:=pg_get_functiondef('public.naxa_device_permissions_v1(uuid)'::regprocedure);
begin
  if position($needle$case when public.naxa_business_function(v_uid)='caisse' then 'POSTE_CAISSE' else 'PHARMACIE' end$needle$ in v_online)=0
    or position($needle$case when public.naxa_business_function(v_uid)='caisse' then 'POSTE_CAISSE' else 'PHARMACIE' end$needle$ in v_offline)=0
    or position($needle$case when public.naxa_business_function(v_device.utilisateur_id)='caisse' then 'POSTE_CAISSE' else 'PHARMACIE' end$needle$ in v_permissions)=0 then
    raise exception 'Les trois chemins doivent sélectionner POSTE_CAISSE pour un compte Caisse';
  end if;
  if position('public.naxa_has_privilege(' in v_online)=0
    or position('public.naxa_has_privilege(' in v_offline)=0
    or position('public.naxa_has_privilege(' in v_permissions)=0 then
    raise exception 'Les contrôles doivent rester branchés sur le moteur de privilèges canonique';
  end if;
end;
$test$;
rollback;
select '277_offline_cashier_scope PASS' as resultat;

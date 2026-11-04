begin;
do $test$
declare
  v_definition text:=pg_get_functiondef('public.naxa_device_permissions_v1(uuid)'::regprocedure);
begin
  if position('public.naxa_has_privilege(' in v_definition)=0
    or position('VIEW_STOCK' in v_definition)=0
    or position('EDIT_STOCK_QUANTITY' in v_definition)=0
    or position('request.jwt.claim.sub' in v_definition)=0 then
    raise exception 'Le helper appareil ne recalcule pas les privilèges de l’utilisateur propriétaire';
  end if;
  if has_function_privilege('anon','public.naxa_device_permissions_v1(uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.naxa_device_permissions_v1(uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.naxa_device_permissions_v1(uuid)','EXECUTE') then
    raise exception 'Le helper de permissions appareil doit rester service_role only';
  end if;
end;
$test$;
rollback;
select '272_offline_device_permission_snapshot PASS' as resultat;

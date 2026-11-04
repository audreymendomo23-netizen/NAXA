begin;
do $test$
declare
  v_definition text:=pg_get_functiondef('public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)'::regprocedure);
begin
  if position('ffffffff-ffff-ffff-ffff-ffffffffffff' in v_definition)=0 then
    raise exception 'Le comptage serveur ne possède pas la priorité de départage';
  end if;
  if position('00000000-0000-0000-0000-000000000000' in v_definition)>0 then
    raise exception 'L'ancien départage avantageant l'appareil hors ligne est encore présent';
  end if;
  if not has_function_privilege('service_role','public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)','EXECUTE')
    or has_function_privilege('anon','public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)','EXECUTE')
    or has_function_privilege('authenticated','public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)','EXECUTE') then
    raise exception 'ACL de la RPC LWW incorrectes';
  end if;
end;
$test$;
rollback;

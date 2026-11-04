begin;
do $test$
declare
  v_definition text:=pg_get_functiondef('public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)'::regprocedure);
begin
  if position($needle$v_profile.role::text not in ('pharmacie','caisse')$needle$ in v_definition)=0
    or position($needle$nullif(btrim(v_profile.fonction_interne),'')$needle$ in v_definition)=0
    or position($needle$ph.id=v_pharmacy and ph.actif is true$needle$ in v_definition)=0
    or position('professional_inactive_or_role_unauthorized' in v_definition)=0 then
    raise exception 'Le garde serveur du rôle et de la pharmacie est incomplet';
  end if;
  if position($needle$case when device_id is null then 1 else 0 end$needle$ in v_definition)=0
    or position($needle$case when v_latest.device_id is null then 1 else 0 end$needle$ in v_definition)=0 then
    raise exception 'Le départage du comptage serveur a régressé';
  end if;
  if not has_function_privilege('service_role','public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)','EXECUTE')
    or has_function_privilege('anon','public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)','EXECUTE')
    or has_function_privilege('authenticated','public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)','EXECUTE') then
    raise exception 'ACL de la RPC LWW incorrectes';
  end if;
end;
$test$;
rollback;

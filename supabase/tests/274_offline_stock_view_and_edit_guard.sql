begin;
do $test$
declare
  v_online text:=pg_get_functiondef('public.offline_stock_set_quantity(uuid,uuid,uuid,integer,timestamptz)'::regprocedure);
  v_offline text:=pg_get_functiondef('public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)'::regprocedure);
begin
  if position($needle$public.naxa_has_privilege('VIEW_STOCK',$needle$ in v_online)=0
    or position($needle$public.naxa_has_privilege('EDIT_STOCK_QUANTITY',$needle$ in v_online)=0
    or position($needle$public.naxa_has_privilege('VIEW_STOCK',$needle$ in v_offline)=0
    or position($needle$public.naxa_has_privilege('EDIT_STOCK_QUANTITY',$needle$ in v_offline)=0 then
    raise exception 'Les RPC online et appareil doivent toutes deux exiger VIEW_STOCK et EDIT_STOCK_QUANTITY';
  end if;
  if position('stock_view_privilege_denied' in v_offline)=0
    or position('stock_edit_privilege_denied' in v_offline)=0 then
    raise exception 'Les deux refus de privilège doivent être explicites et terminaux';
  end if;
  if has_function_privilege('anon','public.offline_stock_set_quantity(uuid,uuid,uuid,integer,timestamptz)','EXECUTE')
    or not has_function_privilege('authenticated','public.offline_stock_set_quantity(uuid,uuid,uuid,integer,timestamptz)','EXECUTE') then
    raise exception 'ACL du RPC online incorrectes';
  end if;
  if has_function_privilege('anon','public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)','EXECUTE')
    or has_function_privilege('authenticated','public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)','EXECUTE')
    or not has_function_privilege('service_role','public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)','EXECUTE') then
    raise exception 'ACL du RPC appareil incorrectes';
  end if;
end;
$test$;
rollback;
select '274_offline_stock_view_and_edit_guard PASS' as resultat;

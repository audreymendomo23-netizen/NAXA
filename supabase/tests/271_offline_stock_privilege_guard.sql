begin;
do $test$
declare
  v_online text:=pg_get_functiondef('public.offline_stock_set_quantity(uuid,uuid,uuid,integer,timestamptz)'::regprocedure);
  v_offline text:=pg_get_functiondef('public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)'::regprocedure);
begin
  if position($needle$public.naxa_has_privilege('EDIT_STOCK_QUANTITY',$needle$ in v_online)=0
    or position($needle$public.naxa_has_privilege('EDIT_STOCK_QUANTITY',$needle$ in v_offline)=0 then
    raise exception 'Le droit EDIT_STOCK_QUANTITY ne protège pas les deux RPC';
  end if;
  if position('public.can_access_pharmacy' in v_online)>0
    or position('v_profile.pharmacie_id is distinct from v_pharmacy' in v_offline)>0 then
    raise exception 'Une autorisation générique ou l’égalité du profil bloque la délégation multi-pharmacie';
  end if;
  if position('stock_edit_privilege_denied' in v_offline)=0 then
    raise exception 'Le refus de privilège doit être enregistré comme résultat terminal';
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
select '271_offline_stock_privilege_guard PASS' as resultat;

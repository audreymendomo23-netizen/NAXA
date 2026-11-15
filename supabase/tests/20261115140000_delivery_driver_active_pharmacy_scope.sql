-- Regression checks: courier actions must remain bound to the mission pharmacy.
do $test$
declare
  v_handover text;
  v_cash text;
begin
  select pg_get_functiondef('public.naxa_delivery_confirm_handover(uuid)'::regprocedure)
    into v_handover;
  select pg_get_functiondef('public.naxa_delivery_courier_declare_cash(uuid,integer)'::regprocedure)
    into v_cash;

  if position('private.naxa_delivery_driver_can_act(v_uid,p_mission)' in v_handover)=0
     or position('v_m.statut<>''arrived''' in v_handover)=0
     or position('V_M.LIVREUR_ID IS DISTINCT FROM V_UID' in upper(v_handover))=0 then
    raise exception $msg$La confirmation de remise ne vérifie pas le Livreur, le statut et le périmètre pharmacie actif$msg$;
  end if;

  if position('private.naxa_delivery_driver_can_act(v_uid,p_mission)' in v_cash)=0
     or position('v_m.statut<>''arrived''' in v_cash)=0
     or position('V_M.LIVREUR_ID IS DISTINCT FROM V_UID' in upper(v_cash))=0
     or position('V_R.PAIEMENT_MODE IS DISTINCT FROM ''ESPECES_LIVRAISON''' in upper(v_cash))=0 then
    raise exception $msg$La déclaration espèces ne vérifie pas le Livreur, le statut, le périmètre et le mode cash$msg$;
  end if;

  if has_function_privilege('anon','public.naxa_delivery_confirm_handover(uuid)'::regprocedure,'EXECUTE')
     or not has_function_privilege('authenticated','public.naxa_delivery_confirm_handover(uuid)'::regprocedure,'EXECUTE')
     or has_function_privilege('anon','public.naxa_delivery_courier_declare_cash(uuid,integer)'::regprocedure,'EXECUTE')
     or not has_function_privilege('authenticated','public.naxa_delivery_courier_declare_cash(uuid,integer)'::regprocedure,'EXECUTE') then
    raise exception $msg$Les ACL des RPC Livreur ne sont pas correctement restreintes$msg$;
  end if;
end
$test$;

select 'Courier confirmation and cash declaration require the active assigned pharmacy: PASS' as result;

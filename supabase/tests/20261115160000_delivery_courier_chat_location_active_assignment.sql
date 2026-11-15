-- Regression checks: all courier chat and location operations require
-- the assigned active courier context; anonymous execution is refused.
do $test$
declare
  v_list text;
  v_message text;
  v_location text;
begin
  select pg_get_functiondef('public.naxa_delivery_list_messages(uuid)'::regprocedure)
    into v_list;
  select pg_get_functiondef('public.naxa_delivery_send_message(uuid,text)'::regprocedure)
    into v_message;
  select pg_get_functiondef('public.naxa_delivery_send_location(uuid,double precision,double precision,double precision)'::regprocedure)
    into v_location;

  v_list := regexp_replace(upper(v_list), '[[:space:]]+', '', 'g');
  v_message := regexp_replace(upper(v_message), '[[:space:]]+', '', 'g');
  v_location := regexp_replace(upper(v_location), '[[:space:]]+', '', 'g');

  if position('PRIVATE.NAXA_DELIVERY_DRIVER_CAN_ACT(V_UID,V_M.ID)' in v_list) = 0
     or position('PRIVATE.NAXA_DELIVERY_DRIVER_CAN_ACT(V_M.LIVREUR_ID,V_M.ID)' in v_list) = 0 then
    raise exception $msg$La lecture et le droit d'écriture conversation doivent vérifier le Livreur actif affecté$msg$;
  end if;

  if position('PRIVATE.NAXA_DELIVERY_DRIVER_CAN_ACT(V_M.LIVREUR_ID,V_M.ID)' in v_message) = 0
     or position('PH.ACTIF=TRUE' in v_message) = 0
     or position('PH.ARCHIVEE_LEISNULL' in v_message) = 0 then
    raise exception $msg$L'envoi de message doit vérifier le contexte Livreur et la pharmacie active$msg$;
  end if;

  if position('PRIVATE.NAXA_DELIVERY_DRIVER_CAN_ACT(V_M.LIVREUR_ID,V_M.ID)' in v_location) = 0
     or position('PH.ACTIF=TRUE' in v_location) = 0
     or position('PH.ARCHIVEE_LEISNULL' in v_location) = 0 then
    raise exception $msg$Le partage GPS doit vérifier le contexte Livreur et la pharmacie active$msg$;
  end if;

  if has_function_privilege('anon','public.naxa_delivery_list_messages(uuid)'::regprocedure,'EXECUTE')
     or not has_function_privilege('authenticated','public.naxa_delivery_list_messages(uuid)'::regprocedure,'EXECUTE')
     or has_function_privilege('anon','public.naxa_delivery_send_message(uuid,text)'::regprocedure,'EXECUTE')
     or not has_function_privilege('authenticated','public.naxa_delivery_send_message(uuid,text)'::regprocedure,'EXECUTE')
     or has_function_privilege('anon','public.naxa_delivery_send_location(uuid,double precision,double precision,double precision)'::regprocedure,'EXECUTE')
     or not has_function_privilege('authenticated','public.naxa_delivery_send_location(uuid,double precision,double precision,double precision)'::regprocedure,'EXECUTE') then
    raise exception $msg$Les ACL des RPC conversation/GPS sont incorrectes$msg$;
  end if;
end
$test$;

select 'Courier chat and GPS require active assigned pharmacy and courier: PASS' as result;

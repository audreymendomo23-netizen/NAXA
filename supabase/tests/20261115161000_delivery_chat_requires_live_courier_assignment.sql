-- Regression test: neither the Client nor the Courier can bypass
-- an inactive/expired courier assignment or a suspended pharmacy.
do $test$
declare
  v_message text;
  v_location text;
begin
  select pg_get_functiondef('public.naxa_delivery_send_message(uuid,text)'::regprocedure)
    into v_message;
  select pg_get_functiondef('public.naxa_delivery_send_location(uuid,double precision,double precision,double precision)'::regprocedure)
    into v_location;

  v_message := regexp_replace(upper(v_message), '[[:space:]]+', '', 'g');
  v_location := regexp_replace(upper(v_location), '[[:space:]]+', '', 'g');

  if position('PRIVATE.NAXA_DELIVERY_DRIVER_CAN_ACT(V_M.LIVREUR_ID,V_M.ID)' in v_message) = 0
     or position('PH.ACTIF=TRUE' in v_message) = 0
     or position('PH.ARCHIVEE_LEISNULL' in v_message) = 0 then
    raise exception $msg$Envoi message : l'affectation Livreur et la pharmacie active doivent être exigées pour les deux parties$msg$;
  end if;

  if position('PRIVATE.NAXA_DELIVERY_DRIVER_CAN_ACT(V_M.LIVREUR_ID,V_M.ID)' in v_location) = 0
     or position('PH.ACTIF=TRUE' in v_location) = 0
     or position('PH.ARCHIVEE_LEISNULL' in v_location) = 0 then
    raise exception $msg$Partage GPS : l'affectation Livreur et la pharmacie active doivent être exigées pour les deux parties$msg$;
  end if;

  if has_function_privilege('anon','public.naxa_delivery_send_message(uuid,text)'::regprocedure,'EXECUTE')
     or not has_function_privilege('authenticated','public.naxa_delivery_send_message(uuid,text)'::regprocedure,'EXECUTE')
     or has_function_privilege('anon','public.naxa_delivery_send_location(uuid,double precision,double precision,double precision)'::regprocedure,'EXECUTE')
     or not has_function_privilege('authenticated','public.naxa_delivery_send_location(uuid,double precision,double precision,double precision)'::regprocedure,'EXECUTE') then
    raise exception $msg$Les ACL des RPC conversation/GPS sont incorrectes$msg$;
  end if;
end
$test$;

select 'Client and Courier chat/location require a live courier assignment: PASS' as result;

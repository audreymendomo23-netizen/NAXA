do $$
declare
  v_definition text;
  v_rpc regprocedure := 'public.naxa_delivery_pending_payment_list_v2(uuid)'::regprocedure;
begin
  select pg_get_functiondef(v_rpc) into v_definition;

  if position('naxa_delivery_payment_confirmations' in v_definition)=0
     or position('naxa_receipt_number' in v_definition)=0
     or position('financial_confirmation_status' in v_definition)=0 then
    raise exception 'La file Caisse ne restitue pas le reçu de confirmation financière';
  end if;

  if not has_function_privilege('authenticated',v_rpc,'execute')
     or has_function_privilege('anon',v_rpc,'execute') then
    raise exception 'ACL de la file Caisse incorrecte';
  end if;
end;
$$;

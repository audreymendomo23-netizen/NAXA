do $$
declare
  v_delivery text;
  v_partner text;
begin
  select pg_get_functiondef('public.naxa_match_delivery_payment_sms(uuid,text)'::regprocedure)
    into v_delivery;
  select pg_get_functiondef('public.naxa_match_universe_payment_sms(uuid,text)'::regprocedure)
    into v_partner;

  if position('pg_advisory_xact_lock' in v_delivery)=0 then
    raise exception 'Le moteur Livraison ne sérialise pas la référence opérateur';
  end if;

  if position('pg_advisory_xact_lock' in v_partner)=0 then
    raise exception 'Le moteur Partenaire ne sérialise pas la référence opérateur';
  end if;

  if not has_function_privilege('service_role','public.naxa_match_delivery_payment_sms(uuid,text)','execute')
     or has_function_privilege('authenticated','public.naxa_match_delivery_payment_sms(uuid,text)','execute')
     or has_function_privilege('anon','public.naxa_match_delivery_payment_sms(uuid,text)','execute')
     or not has_function_privilege('service_role','public.naxa_match_universe_payment_sms(uuid,text)','execute')
     or has_function_privilege('authenticated','public.naxa_match_universe_payment_sms(uuid,text)','execute')
     or has_function_privilege('anon','public.naxa_match_universe_payment_sms(uuid,text)','execute') then
    raise exception 'Les ACL des moteurs de rapprochement ont été modifiées';
  end if;
end;
$$;

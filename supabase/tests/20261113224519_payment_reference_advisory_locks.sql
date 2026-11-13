do $$
declare
  v_delivery text;
  v_partner text;
begin
  select pg_get_functiondef('public.naxa_match_delivery_payment_sms(uuid,text)'::regprocedure)
    into v_delivery;
  select pg_get_functiondef('public.naxa_match_universe_payment_sms(uuid,text)'::regprocedure)
    into v_partner;

  if position('upper(regexp_replace(trim(coalesce(p_transaction_reference' in v_delivery)=0
     or position('perform pg_advisory_xact_lock(hashtextextended(v_ref,0));' in v_delivery)=0
     or position('perform pg_advisory_xact_lock(hashtextextended(v_ref,0));' in v_delivery)>
        position('select count(*) into v_record_count' in v_delivery) then
    raise exception 'Livraison doit verrouiller la référence normalisée avant le comptage';
  end if;

  if position('upper(regexp_replace(trim(coalesce(p_transaction_reference' in v_partner)=0
     or position('perform pg_advisory_xact_lock(hashtextextended(v_ref,0));' in v_partner)=0
     or position('perform pg_advisory_xact_lock(hashtextextended(v_ref,0));' in v_partner)>
        position('select count(*) into v_intent_count' in v_partner) then
    raise exception 'Partenaire doit verrouiller la référence normalisée avant le comptage';
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

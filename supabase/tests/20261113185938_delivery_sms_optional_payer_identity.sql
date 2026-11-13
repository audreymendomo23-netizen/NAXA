do $$
declare
  v_definition text;
  v_function regprocedure := 'public.naxa_match_delivery_payment_sms(uuid,text)'::regprocedure;
begin
  select pg_get_functiondef(v_function) into v_definition;

  if position('or v_record.payer_number is null' in v_definition) > 0 then
    raise exception 'Regression: le numéro payeur est redevenu obligatoire côté payeur';
  end if;

  if position('or v_event.payer_number_tail is null' in v_definition) > 0 then
    raise exception 'Regression: le numéro payeur est redevenu obligatoire côté SMS bénéficiaire';
  end if;

  if position('v_event.payer_number_tail is not null' in v_definition) = 0
     or position('v_payer_tail is not null' in v_definition) = 0 then
    raise exception 'Le contrôle de cohérence des numéros présents des deux côtés est absent';
  end if;

  if position('v_event.amount is distinct from v_record.expected_amount' in v_definition) = 0 then
    raise exception 'Le contrôle du montant attendu a disparu';
  end if;

  if not has_function_privilege('service_role', v_function, 'EXECUTE')
     or has_function_privilege('authenticated', v_function, 'EXECUTE')
     or has_function_privilege('anon', v_function, 'EXECUTE') then
    raise exception 'Les droits du moteur de rapprochement sont incorrects';
  end if;
end;
$$;

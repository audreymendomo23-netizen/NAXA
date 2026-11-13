do $$
declare
  v_transition text;
  v_cancel text;
  v_receipt text;
  v_matcher text;
begin
  select pg_get_functiondef('public.transition_universe_reservation(uuid,text)'::regprocedure)
    into v_transition;
  select pg_get_functiondef('public.naxa_universe_cancel_payment_intent(uuid,uuid)'::regprocedure)
    into v_cancel;
  select pg_get_functiondef('public.get_universe_reservation_receipt(uuid)'::regprocedure)
    into v_receipt;
  select pg_get_functiondef('public.naxa_match_universe_payment_sms(uuid,text)'::regprocedure)
    into v_matcher;

  if position('r.payment_status<>''awaiting_payment''' in v_transition)=0
     or position('i.status in (''submitted'',''matched'')' in v_transition)=0
     or position('r.payment_status<>''confirmed''' in v_transition)=0 then
    raise exception 'La transition ne protège pas l''annulation après soumission et le retrait avant confirmation';
  end if;

  if position('v_intent.status<>''active''' in v_cancel)=0
     or position('v_res.payment_status<>''awaiting_payment''' in v_cancel)=0 then
    raise exception 'Le RPC d''annulation autorise une intention déjà soumise';
  end if;

  if position('payment_mode text' in v_receipt)=0
     or position('payment_status text' in v_receipt)=0 then
    raise exception 'Le reçu de réservation ne restitue pas le mode et le statut du paiement';
  end if;

  if position('naxa_universe_payment_confirmations' in v_matcher)=0
     or position('coherent_confirmed' in v_matcher)=0
     or position('transaction_reference_already_confirmed' in v_matcher)=0 then
    raise exception 'Le moteur Partenaire ne protège pas la confirmation et la réutilisation d''un ID';
  end if;

  if has_function_privilege('anon','public.transition_universe_reservation(uuid,text)','execute')
     or not has_function_privilege('authenticated','public.transition_universe_reservation(uuid,text)','execute')
     or has_function_privilege('anon','public.get_universe_reservation_receipt(uuid)','execute')
     or not has_function_privilege('authenticated','public.get_universe_reservation_receipt(uuid)','execute')
     or has_function_privilege('anon','public.naxa_universe_cancel_payment_intent(uuid,uuid)','execute')
     or has_function_privilege('authenticated','public.naxa_universe_cancel_payment_intent(uuid,uuid)','execute') then
    raise exception 'Les ACL des RPC Partenaire sont incorrectes';
  end if;

  if has_table_privilege('authenticated','public.naxa_universe_payment_intents','select')
     or has_table_privilege('authenticated','public.naxa_universe_payment_confirmations','select')
     or has_table_privilege('anon','public.naxa_universe_payment_intents','select')
     or has_table_privilege('anon','public.naxa_universe_payment_confirmations','select') then
    raise exception 'Les tables techniques du paiement Partenaire sont exposées directement';
  end if;
end;
$$;

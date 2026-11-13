do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.naxa_match_delivery_payment_sms(uuid,text)'::regprocedure)
    into v_definition;

  if position('delivery_payment_confirmed_sms' in v_definition)=0
     or position('delivery_payment_sms_matched' in v_definition)=0 then
    raise exception 'Le matcher ne notifie pas les deux côtés après confirmation';
  end if;

  if position('v_existing.receipt_number' in v_definition)=0
     or position('delivery_payment_confirmed_sms' in v_definition)=0 then
    raise exception 'La notification Client ne référence pas le reçu NAXA';
  end if;

  if position('naxa_delivery_payment_confirmations' in v_definition)=0
     or position('financially_confirmed_waiting_pos' in v_definition)=0 then
    raise exception 'La notification ne suit pas la création de la confirmation durable';
  end if;
end;
$$;

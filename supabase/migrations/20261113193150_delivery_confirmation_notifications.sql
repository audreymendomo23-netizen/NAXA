do $$
declare
  v_definition text;
  v_old text := $old$
  update public.naxa_delivery_payment_intents
  set status='matched',matched_at=now(),updated_at=now()
  where id=v_record.payment_intent_id and status in ('active','submitted');

  return jsonb_build_object(
$old$;
  v_new text := $new$
  update public.naxa_delivery_payment_intents
  set status='matched',matched_at=now(),updated_at=now()
  where id=v_record.payment_intent_id and status in ('active','submitted');

  insert into public.notifications(
    user_id,type,titre,corps,reservation_id,related_entity_id
  ) values (
    v_record.client_id,
    'delivery_payment_confirmed_sms',
    'Paiement Mobile Money confirmé par NAXA',
    'Les SMS de débit et de crédit concordent. Votre reçu NAXA ' || v_existing.receipt_number ||
      ' confirme le paiement de ' || v_record.expected_amount::text ||
      ' FCFA. La pharmacie doit encore inscrire le ticket dans sa Caisse.',
    v_record.reservation_id,
    v_existing.id
  );

  insert into public.notifications(
    pharmacie_id,type,titre,corps,reservation_id
  ) values (
    v_record.pharmacie_id,
    'delivery_payment_sms_matched',
    'Paiement confirmé · ticket POS à inscrire',
    'NAXA a rapproché les SMS débit/crédit pour ' || v_record.expected_amount::text ||
      ' FCFA (reçu ' || v_existing.receipt_number || '). Enregistrez la vente dans une session Caisse ouverte.',
    v_record.reservation_id
  );

  return jsonb_build_object(
$new$;
begin
  select pg_get_functiondef('public.naxa_match_delivery_payment_sms(uuid,text)'::regprocedure)
    into v_definition;
  if position(v_old in v_definition)=0 then
    raise exception 'Bloc d''insertion notification non trouvé dans le matcher';
  end if;
  execute replace(v_definition,v_old,v_new);
end;
$$;

begin;

create or replace function public.naxa_match_delivery_payment_sms(
  p_pharmacie uuid,
  p_transaction_reference text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_ref text := upper(regexp_replace(trim(coalesce(p_transaction_reference,'')), '[^A-Za-z0-9]', '', 'g'));
  v_record_count integer := 0;
  v_event_count integer := 0;
  v_destination_count integer := 0;
  v_record public.naxa_delivery_payment_records%rowtype;
  v_event public.naxa_payment_evidence_intake%rowtype;
  v_intent public.naxa_delivery_payment_intents%rowtype;
  v_channel text;
  v_merchant_phone text;
  v_merchant_tail text;
  v_payer_tail text;
begin
  if auth.role() <> 'service_role' then raise exception 'Service interne NAXA requis'; end if;
  if p_pharmacie is null or length(v_ref) < 5 or length(v_ref) > 120 then
    raise exception 'Pharmacie ou ID de transaction invalide';
  end if;

  select count(*) into v_record_count
  from public.naxa_delivery_payment_records pr
  where pr.pharmacie_id=p_pharmacie and pr.status='declared'
    and pr.mode in ('mtn_marchand','orange_money')
    and upper(regexp_replace(coalesce(pr.reference,''),'[^A-Za-z0-9]','','g'))=v_ref;
  if v_record_count=0 then return jsonb_build_object('status','waiting_for_payer_declaration'); end if;
  if v_record_count>1 then
    update public.naxa_delivery_payment_records pr
    set sms_match_status='manual_review',updated_at=now()
    where pr.pharmacie_id=p_pharmacie and pr.status='declared'
      and pr.mode in ('mtn_marchand','orange_money')
      and upper(regexp_replace(coalesce(pr.reference,''),'[^A-Za-z0-9]','','g'))=v_ref;
    return jsonb_build_object('status','ambiguous_payment_reference');
  end if;

  select * into v_record
  from public.naxa_delivery_payment_records pr
  where pr.pharmacie_id=p_pharmacie and pr.status='declared'
    and pr.mode in ('mtn_marchand','orange_money')
    and upper(regexp_replace(coalesce(pr.reference,''),'[^A-Za-z0-9]','','g'))=v_ref
  for update;

  if v_record.sms_match_status='matched' and v_record.merchant_sms_evidence_id is not null then
    return jsonb_build_object('status','already_matched','payment_record_id',v_record.id,
      'merchant_evidence_id',v_record.merchant_sms_evidence_id);
  end if;
  if v_record.proof_source<>'shared_sms' or v_record.sms_payload_sha256 is null
     or v_record.sms_payload_sha256 !~ '^[0-9a-f]{64}$'
     or v_record.declared_amount is distinct from v_record.expected_amount
     or (v_record.payer_number is not null
       and length(regexp_replace(v_record.payer_number,'[^0-9]','','g')) not between 8 and 15) then
    update public.naxa_delivery_payment_records set sms_match_status='manual_review',updated_at=now()
    where id=v_record.id;
    return jsonb_build_object('status','payer_sms_incomplete_or_mismatched','payment_record_id',v_record.id);
  end if;

  if v_record.payment_intent_id is null then
    update public.naxa_delivery_payment_records
    set sms_match_status='manual_review',updated_at=now()
    where id=v_record.id;
    return jsonb_build_object(
      'status','payment_intent_missing_manual_review',
      'payment_record_id',v_record.id
    );
  end if;

  v_channel:=case when v_record.mode='mtn_marchand' then 'mtn_momo' else 'orange_money' end;
  v_payer_tail:=case when v_record.payer_number is null then null
    else right(regexp_replace(v_record.payer_number,'[^0-9]','','g'),9) end;

  select count(*) into v_event_count
  from public.naxa_payment_evidence_intake e
  where e.workspace_type='pharmacie' and e.workspace_id=p_pharmacie
    and e.canal=v_channel and e.source_type='sms_receiver'
    and e.direction='merchant_credit' and e.success=true
    and e.match_status='manual_review' and e.transaction_reference is not null
    and upper(regexp_replace(e.transaction_reference,'[^A-Za-z0-9]','','g'))=v_ref;
  if v_event_count=0 then
    update public.naxa_delivery_payment_records set sms_match_status='awaiting_merchant_sms',updated_at=now()
    where id=v_record.id;
    return jsonb_build_object('status','waiting_for_merchant_sms','payment_record_id',v_record.id);
  end if;
  if v_event_count>1 then
    update public.naxa_delivery_payment_records set sms_match_status='manual_review',updated_at=now()
    where id=v_record.id;
    return jsonb_build_object('status','ambiguous_merchant_sms','payment_record_id',v_record.id);
  end if;

  select * into v_event
  from public.naxa_payment_evidence_intake e
  where e.workspace_type='pharmacie' and e.workspace_id=p_pharmacie
    and e.canal=v_channel and e.source_type='sms_receiver'
    and e.direction='merchant_credit' and e.success=true
    and e.match_status='manual_review' and e.transaction_reference is not null
    and upper(regexp_replace(e.transaction_reference,'[^A-Za-z0-9]','','g'))=v_ref
  for update;

  if v_event.amount is distinct from v_record.expected_amount
     or v_event.source_payload_sha256=v_record.sms_payload_sha256
     or (v_event.payer_number_tail is not null and v_payer_tail is not null
       and v_event.payer_number_tail<>v_payer_tail) then
    update public.naxa_delivery_payment_records set sms_match_status='manual_review',updated_at=now()
    where id=v_record.id;
    return jsonb_build_object('status','merchant_sms_details_mismatch','payment_record_id',v_record.id);
  end if;

  select * into v_intent
  from public.naxa_delivery_payment_intents i
  where i.id=v_record.payment_intent_id
    and i.reservation_id=v_record.reservation_id
    and i.pharmacie_id=p_pharmacie
    and i.canal=v_channel
    and i.expected_amount=v_record.expected_amount
    and i.status in ('active','submitted','matched')
  for update;
  if not found then
    update public.naxa_delivery_payment_records set sms_match_status='manual_review',updated_at=now()
    where id=v_record.id;
    return jsonb_build_object('status','payment_intent_snapshot_missing','payment_record_id',v_record.id);
  end if;

  v_merchant_phone:=v_intent.destination_snapshot->>'merchant_phone';
  v_destination_count:=case
    when v_intent.destination_snapshot->>'merchant_code' ~ '^[0-9]{6}$'
     and length(regexp_replace(coalesce(v_merchant_phone,''),'[^0-9]','','g')) between 8 and 15
    then 1 else 0 end;

  if v_destination_count<>1 then
    update public.naxa_delivery_payment_records set sms_match_status='manual_review',updated_at=now()
    where id=v_record.id;
    return jsonb_build_object('status','merchant_destination_snapshot_invalid','payment_record_id',v_record.id);
  end if;

  v_merchant_tail:=right(regexp_replace(coalesce(v_merchant_phone,''),'[^0-9]','','g'),9);
  if v_event.merchant_number_tail is not null and length(v_merchant_tail)>=8
     and v_event.merchant_number_tail<>v_merchant_tail then
    update public.naxa_delivery_payment_records set sms_match_status='manual_review',updated_at=now()
    where id=v_record.id;
    return jsonb_build_object('status','merchant_destination_mismatch','payment_record_id',v_record.id);
  end if;

  if v_event.provider_occurred_at is not null
     and abs(extract(epoch from (v_event.provider_occurred_at-v_record.payment_occurred_at)))>86400 then
    update public.naxa_delivery_payment_records set sms_match_status='manual_review',updated_at=now()
    where id=v_record.id;
    return jsonb_build_object('status','provider_timestamp_mismatch','payment_record_id',v_record.id);
  end if;

  update public.naxa_delivery_payment_records
  set sms_match_status='matched',merchant_sms_evidence_id=v_event.id,sms_matched_at=now(),updated_at=now()
  where id=v_record.id;
  update public.naxa_payment_evidence_intake
  set match_status='coherent_unconfirmed'
  where id=v_event.id and match_status='manual_review';
  update public.naxa_delivery_payment_intents
  set status='matched',matched_at=now(),updated_at=now()
  where id=v_record.payment_intent_id and status in ('active','submitted');

  return jsonb_build_object('status','matched_waiting_pos','payment_record_id',v_record.id,
    'merchant_evidence_id',v_event.id,'transaction_reference',v_ref,
    'amount',v_record.expected_amount,'matched_at',now());
end;
$function$;

revoke all on function public.naxa_match_delivery_payment_sms(uuid,text) from public,anon,authenticated;
grant execute on function public.naxa_match_delivery_payment_sms(uuid,text) to service_role;

commit;

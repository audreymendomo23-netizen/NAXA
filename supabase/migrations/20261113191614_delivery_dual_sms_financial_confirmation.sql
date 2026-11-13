begin;

create sequence if not exists public.naxa_delivery_payment_receipt_seq;

alter table public.naxa_payment_evidence_intake
  drop constraint if exists naxa_payment_evidence_intake_match_status_check;
alter table public.naxa_payment_evidence_intake
  add constraint naxa_payment_evidence_intake_match_status_check
  check (match_status in ('manual_review','coherent_unconfirmed','coherent_confirmed'));

create table if not exists public.naxa_delivery_payment_confirmations (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  payment_record_id uuid not null unique references public.naxa_delivery_payment_records(id) on delete restrict,
  reservation_id uuid not null unique references public.reservations(id) on delete restrict,
  payment_intent_id uuid not null unique references public.naxa_delivery_payment_intents(id) on delete restrict,
  merchant_evidence_id uuid not null unique references public.naxa_payment_evidence_intake(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  client_id uuid not null references auth.users(id) on delete restrict,
  canal text not null check (canal in ('orange_money','mtn_momo')),
  transaction_reference text not null,
  reference_normalisee text not null,
  amount_fcfa integer not null check (amount_fcfa > 0),
  destination_snapshot jsonb not null check (jsonb_typeof(destination_snapshot)='object'),
  payer_sms_sha256 text not null check (payer_sms_sha256 ~ '^[0-9a-f]{64}$'),
  merchant_sms_sha256 text not null check (merchant_sms_sha256 ~ '^[0-9a-f]{64}$'),
  payer_number_tail text,
  merchant_number_tail text,
  payer_occurred_at timestamptz,
  payer_declared_at timestamptz not null,
  merchant_occurred_at timestamptz,
  merchant_received_at timestamptz not null,
  confirmation_status text not null default 'confirmed' check (confirmation_status='confirmed'),
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint naxa_delivery_payment_confirmations_distinct_sms_ck check (payer_sms_sha256 <> merchant_sms_sha256),
  constraint naxa_delivery_payment_confirmations_payer_tail_ck check (payer_number_tail is null or payer_number_tail ~ '^[0-9]{4,9}$'),
  constraint naxa_delivery_payment_confirmations_merchant_tail_ck check (merchant_number_tail is null or merchant_number_tail ~ '^[0-9]{4,9}$')
);

create unique index if not exists naxa_delivery_payment_confirmations_operator_ref_uq
  on public.naxa_delivery_payment_confirmations(canal, reference_normalisee);
create index if not exists naxa_delivery_payment_confirmations_pharmacy_date_idx
  on public.naxa_delivery_payment_confirmations(pharmacie_id, confirmed_at desc);
create index if not exists naxa_delivery_payment_confirmations_client_date_idx
  on public.naxa_delivery_payment_confirmations(client_id, confirmed_at desc);

alter table public.naxa_delivery_payment_confirmations enable row level security;
revoke all on public.naxa_delivery_payment_confirmations from public, anon, authenticated;
grant all on public.naxa_delivery_payment_confirmations to service_role;
revoke all on sequence public.naxa_delivery_payment_receipt_seq from public, anon, authenticated;
grant usage, select on sequence public.naxa_delivery_payment_receipt_seq to service_role;

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
  v_duplicate_count integer := 0;
  v_record public.naxa_delivery_payment_records%rowtype;
  v_event public.naxa_payment_evidence_intake%rowtype;
  v_intent public.naxa_delivery_payment_intents%rowtype;
  v_existing public.naxa_delivery_payment_confirmations%rowtype;
  v_channel text;
  v_merchant_phone text;
  v_merchant_tail text;
  v_payer_tail text;
  v_receipt text;
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

  select * into v_existing
  from public.naxa_delivery_payment_confirmations c
  where c.payment_record_id=v_record.id
  limit 1;
  if found then
    return jsonb_build_object(
      'status','financially_confirmed_waiting_pos',
      'payment_record_id',v_record.id,
      'confirmation_id',v_existing.id,
      'receipt_number',v_existing.receipt_number,
      'confirmed_at',v_existing.confirmed_at
    );
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
    return jsonb_build_object('status','payment_intent_missing_manual_review','payment_record_id',v_record.id);
  end if;

  v_channel:=case when v_record.mode='mtn_marchand' then 'mtn_momo' else 'orange_money' end;
  v_payer_tail:=case when v_record.payer_number is null then null
    else right(regexp_replace(v_record.payer_number,'[^0-9]','','g'),9) end;

  select count(*) into v_event_count
  from public.naxa_payment_evidence_intake e
  where e.workspace_type='pharmacie' and e.workspace_id=p_pharmacie
    and e.canal=v_channel and e.source_type='sms_receiver'
    and e.direction='merchant_credit' and e.success=true
    and e.match_status in ('manual_review','coherent_unconfirmed')
    and e.transaction_reference is not null
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
    and e.match_status in ('manual_review','coherent_unconfirmed')
    and e.transaction_reference is not null
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
  if v_intent.destination_snapshot->>'merchant_code' !~ '^[0-9]{6}$'
     or length(regexp_replace(coalesce(v_merchant_phone,''),'[^0-9]','','g')) not between 8 and 15 then
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

  select count(*) into v_duplicate_count
  from public.naxa_delivery_payment_confirmations c
  where c.canal=v_channel and c.reference_normalisee=v_ref;
  if v_duplicate_count>0 then
    update public.naxa_delivery_payment_records set sms_match_status='manual_review',updated_at=now()
    where id=v_record.id;
    return jsonb_build_object('status','transaction_reference_already_confirmed','payment_record_id',v_record.id);
  end if;

  v_receipt := 'NAXA-LIV-' ||
    to_char(now() at time zone 'Africa/Douala','YYYYMMDD') || '-' ||
    lpad(nextval('public.naxa_delivery_payment_receipt_seq')::text,8,'0');

  insert into public.naxa_delivery_payment_confirmations(
    receipt_number,payment_record_id,reservation_id,payment_intent_id,
    merchant_evidence_id,pharmacie_id,client_id,canal,transaction_reference,
    reference_normalisee,amount_fcfa,destination_snapshot,payer_sms_sha256,
    merchant_sms_sha256,payer_number_tail,merchant_number_tail,
    payer_occurred_at,payer_declared_at,merchant_occurred_at,merchant_received_at
  ) values (
    v_receipt,v_record.id,v_record.reservation_id,v_intent.id,
    v_event.id,p_pharmacie,v_record.client_id,v_channel,v_record.reference,
    v_ref,v_record.expected_amount,v_intent.destination_snapshot,v_record.sms_payload_sha256,
    v_event.source_payload_sha256,v_payer_tail,v_event.merchant_number_tail,
    v_record.payment_occurred_at,v_record.declared_at,v_event.provider_occurred_at,v_event.received_at
  ) returning * into v_existing;

  update public.naxa_delivery_payment_records
  set sms_match_status='matched',merchant_sms_evidence_id=v_event.id,
      sms_matched_at=now(),updated_at=now()
  where id=v_record.id;

  update public.naxa_payment_evidence_intake
  set match_status='coherent_confirmed'
  where id=v_event.id and match_status in ('manual_review','coherent_unconfirmed');

  update public.naxa_delivery_payment_intents
  set status='matched',matched_at=now(),updated_at=now()
  where id=v_record.payment_intent_id and status in ('active','submitted');

  return jsonb_build_object(
    'status','financially_confirmed_waiting_pos',
    'payment_record_id',v_record.id,
    'confirmation_id',v_existing.id,
    'receipt_number',v_existing.receipt_number,
    'transaction_reference',v_ref,
    'amount',v_record.expected_amount,
    'confirmed_at',v_existing.confirmed_at
  );
end;
$function$;

revoke all on function public.naxa_match_delivery_payment_sms(uuid,text) from public,anon,authenticated;
grant execute on function public.naxa_match_delivery_payment_sms(uuid,text) to service_role;

commit;

begin;

alter table public.universe_reservations
  add column if not exists payment_mode text,
  add column if not exists payment_status text not null default 'not_required';

alter table public.universe_reservations
  drop constraint if exists universe_reservations_payment_mode_ck;
alter table public.universe_reservations
  add constraint universe_reservations_payment_mode_ck
  check (payment_mode is null or payment_mode in ('orange_money','mtn_momo'));

alter table public.universe_reservations
  drop constraint if exists universe_reservations_payment_status_ck;
alter table public.universe_reservations
  add constraint universe_reservations_payment_status_ck
  check (payment_status in ('not_required','awaiting_payment','declared','confirmed','manual_review'));

create table if not exists public.naxa_universe_payment_intents (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.universe_reservations(id) on delete restrict,
  partner_id uuid not null references public.partners(id) on delete restrict,
  client_id uuid not null references auth.users(id) on delete restrict,
  canal text not null check (canal in ('orange_money','mtn_momo')),
  expected_amount integer not null check (expected_amount > 0),
  destination_id uuid not null references public.naxa_merchant_payment_destinations(id) on delete restrict,
  destination_snapshot jsonb not null check (jsonb_typeof(destination_snapshot)='object'),
  status text not null default 'active'
    check (status in ('active','submitted','matched','expired','cancelled')),
  transaction_reference text,
  payer_number text,
  payer_number_tail text,
  declared_amount integer,
  payer_occurred_at timestamptz,
  payer_declared_at timestamptz,
  proof_source text check (proof_source is null or proof_source in ('shared_sms','manual_entry')),
  field_sources jsonb not null default '{}'::jsonb,
  payer_sms_sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  matched_at timestamptz,
  constraint naxa_universe_payment_intents_expiry_ck check (expires_at > created_at),
  constraint naxa_universe_payment_intents_reference_ck
    check (transaction_reference is null or length(transaction_reference) between 5 and 120),
  constraint naxa_universe_payment_intents_payer_hash_ck
    check (payer_sms_sha256 is null or payer_sms_sha256 ~ '^[0-9a-f]{64}$')
);
create unique index if not exists naxa_universe_payment_intents_active_uq
  on public.naxa_universe_payment_intents(reservation_id) where status='active';
create index if not exists naxa_universe_payment_intents_partner_ref_idx
  on public.naxa_universe_payment_intents(partner_id,canal,status,transaction_reference);
create index if not exists naxa_universe_payment_intents_reservation_idx
  on public.naxa_universe_payment_intents(reservation_id,created_at desc);

alter table public.naxa_universe_payment_intents enable row level security;
revoke all on public.naxa_universe_payment_intents from public,anon,authenticated;
grant all on public.naxa_universe_payment_intents to service_role;

create sequence if not exists public.naxa_universe_payment_receipt_seq;

create table if not exists public.naxa_universe_payment_confirmations (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  payment_intent_id uuid not null unique references public.naxa_universe_payment_intents(id) on delete restrict,
  reservation_id uuid not null unique references public.universe_reservations(id) on delete restrict,
  merchant_evidence_id uuid not null unique references public.naxa_payment_evidence_intake(id) on delete restrict,
  partner_id uuid not null references public.partners(id) on delete restrict,
  client_id uuid not null references auth.users(id) on delete restrict,
  canal text not null check (canal in ('orange_money','mtn_momo')),
  transaction_reference text not null,
  reference_normalisee text not null,
  amount_fcfa integer not null check (amount_fcfa>0),
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
  constraint naxa_universe_payment_confirmations_distinct_sms_ck
    check (payer_sms_sha256<>merchant_sms_sha256)
);
create unique index if not exists naxa_universe_payment_confirmations_operator_ref_uq
  on public.naxa_universe_payment_confirmations(canal,reference_normalisee);
create index if not exists naxa_universe_payment_confirmations_partner_date_idx
  on public.naxa_universe_payment_confirmations(partner_id,confirmed_at desc);
create index if not exists naxa_universe_payment_confirmations_client_date_idx
  on public.naxa_universe_payment_confirmations(client_id,confirmed_at desc);

alter table public.naxa_universe_payment_confirmations enable row level security;
revoke all on public.naxa_universe_payment_confirmations from public,anon,authenticated;
grant all on public.naxa_universe_payment_confirmations to service_role;
revoke all on sequence public.naxa_universe_payment_receipt_seq from public,anon,authenticated;
grant usage,select on sequence public.naxa_universe_payment_receipt_seq to service_role;

create or replace function public.naxa_universe_get_or_create_payment_intent(
  p_reservation uuid,p_client uuid,p_canal text
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
  v_res public.universe_reservations%rowtype;
  v_partner public.partners%rowtype;
  v_destination public.naxa_merchant_payment_destinations%rowtype;
  v_intent public.naxa_universe_payment_intents%rowtype;
  v_snapshot jsonb;
  v_expiry timestamptz;
begin
  if auth.role()<>'service_role' then raise exception 'Service NAXA requis'; end if;
  if p_reservation is null or p_client is null or p_canal not in ('orange_money','mtn_momo') then
    raise exception 'Intention de paiement invalide';
  end if;
  select * into v_res from public.universe_reservations
  where id=p_reservation for update;
  if not found or v_res.client_id<>p_client
     or v_res.status not in ('confirmed','ready') or v_res.expires_at<=now()
     or v_res.total_fcfa<=0 then
    raise exception 'Réservation non éligible au paiement électronique';
  end if;
  select * into v_partner from public.partners
  where id=v_res.partner_id and status='active';
  if not found then raise exception 'Partenaire inactif ou introuvable'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_reservation::text,0));
  select * into v_intent
  from public.naxa_universe_payment_intents i
  where i.reservation_id=p_reservation and i.status in ('active','submitted','matched')
  order by i.created_at desc limit 1 for update;

  if found then
    if v_intent.status in ('submitted','matched') then
      if v_intent.canal<>p_canal then
        raise exception 'Un paiement a déjà été soumis avec cet opérateur ; changement de canal impossible';
      end if;
      return jsonb_build_object(
        'id',v_intent.id,'canal',v_intent.canal,'expected_amount',v_intent.expected_amount,
        'destination_snapshot',v_intent.destination_snapshot,'status',v_intent.status,
        'expires_at',v_intent.expires_at
      );
    end if;
    if v_intent.status='active' and v_intent.canal=p_canal and v_intent.expires_at>now() then
      return jsonb_build_object(
        'id',v_intent.id,'canal',v_intent.canal,'expected_amount',v_intent.expected_amount,
        'destination_snapshot',v_intent.destination_snapshot,'status',v_intent.status,
        'expires_at',v_intent.expires_at
      );
    end if;
    if v_intent.status='active' then
      update public.naxa_universe_payment_intents set status='cancelled',updated_at=now()
      where id=v_intent.id and status='active';
    end if;
  end if;

  select * into v_destination
  from public.naxa_merchant_payment_destinations d
  where d.partner_id=v_res.partner_id and d.canal=p_canal and d.is_active=true
  limit 1;
  if not found then raise exception 'Coordonnées marchandes non activées pour cet opérateur'; end if;
  v_expiry:=least(v_res.expires_at,now()+interval '24 hours');
  if v_expiry<=now() then raise exception 'Réservation expirée'; end if;

  v_snapshot:=jsonb_build_object(
    'destination_id',v_destination.id,'merchant_name',v_destination.merchant_name,
    'merchant_phone',v_destination.merchant_phone,'merchant_code',v_destination.merchant_code,
    'canal',v_destination.canal,'partner_name',v_partner.name,'captured_at',now()
  );
  insert into public.naxa_universe_payment_intents(
    reservation_id,partner_id,client_id,canal,expected_amount,
    destination_id,destination_snapshot,status,expires_at
  ) values (
    p_reservation,v_res.partner_id,p_client,p_canal,v_res.total_fcfa,
    v_destination.id,v_snapshot,'active',v_expiry
  ) returning * into v_intent;
  update public.universe_reservations
  set payment_mode=p_canal,payment_status='awaiting_payment',updated_at=now()
  where id=p_reservation;
  return jsonb_build_object(
    'id',v_intent.id,'canal',v_intent.canal,'expected_amount',v_intent.expected_amount,
    'destination_snapshot',v_intent.destination_snapshot,'status',v_intent.status,
    'expires_at',v_intent.expires_at
  );
end;
$function$;
revoke all on function public.naxa_universe_get_or_create_payment_intent(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.naxa_universe_get_or_create_payment_intent(uuid,uuid,text)
  to service_role;

create or replace function public.naxa_universe_declare_payment(
  p_reservation uuid,p_client uuid,p_canal text,p_reference text,p_payer_number text,
  p_declared_amount integer,p_payment_occurred_at timestamptz,p_proof_source text,
  p_field_sources jsonb default '{}'::jsonb,p_sms_payload_sha256 text default null
) returns boolean
language plpgsql security definer set search_path=''
as $function$
declare
  v_res public.universe_reservations%rowtype;
  v_intent public.naxa_universe_payment_intents%rowtype;
  v_reference text:=trim(coalesce(p_reference,''));
  v_now timestamptz:=now();
begin
  if auth.role()<>'service_role' then raise exception 'Service NAXA requis'; end if;
  if p_reservation is null or p_client is null
     or p_canal not in ('orange_money','mtn_momo')
     or p_proof_source not in ('shared_sms','manual_entry')
     or length(v_reference)<5 or length(v_reference)>120
     or v_reference !~ '^[[:alnum:][:space:]_./-]+$'
     or p_declared_amount is null or p_declared_amount<=0
     or p_payment_occurred_at is null
     or p_payment_occurred_at>v_now+interval '5 minutes'
     or p_payment_occurred_at<v_now-interval '7 days' then
    raise exception 'Déclaration de paiement invalide';
  end if;
  if p_payer_number is not null and length(regexp_replace(p_payer_number,'[^0-9]','','g')) not between 8 and 15 then
    raise exception 'Numéro payeur invalide';
  end if;
  if p_sms_payload_sha256 is not null and p_sms_payload_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Empreinte SMS invalide';
  end if;

  select * into v_res from public.universe_reservations
  where id=p_reservation for update;
  if not found or v_res.client_id<>p_client or v_res.status not in ('confirmed','ready')
     or v_res.expires_at<=v_now or v_res.payment_mode is distinct from p_canal
     or v_res.payment_status='confirmed' then
    raise exception 'Réservation non éligible à cette déclaration';
  end if;

  select * into v_intent from public.naxa_universe_payment_intents
  where reservation_id=p_reservation and canal=p_canal
    and status='active' and expires_at>v_now
  order by created_at desc limit 1 for update;
  if not found then raise exception 'Intention de paiement absente ou expirée'; end if;

  update public.naxa_universe_payment_intents
  set status='submitted',transaction_reference=v_reference,
      payer_number=nullif(trim(coalesce(p_payer_number,'')),''),
      payer_number_tail=case when p_payer_number is null then null
        else right(regexp_replace(p_payer_number,'[^0-9]','','g'),9) end,
      declared_amount=p_declared_amount,payer_occurred_at=p_payment_occurred_at,
      payer_declared_at=v_now,proof_source=p_proof_source,
      field_sources=case when jsonb_typeof(coalesce(p_field_sources,'{}'::jsonb))='object'
        then coalesce(p_field_sources,'{}'::jsonb) else '{}'::jsonb end,
      payer_sms_sha256=p_sms_payload_sha256,submitted_at=v_now,updated_at=v_now
  where id=v_intent.id;
  update public.universe_reservations
  set payment_status=case when p_proof_source='shared_sms' then 'declared' else 'manual_review' end,
      updated_at=v_now
  where id=p_reservation;
  return true;
end;
$function$;
revoke all on function public.naxa_universe_declare_payment(uuid,uuid,text,text,text,integer,timestamptz,text,jsonb,text)
  from public,anon,authenticated;
grant execute on function public.naxa_universe_declare_payment(uuid,uuid,text,text,text,integer,timestamptz,text,jsonb,text)
  to service_role;

create or replace function public.naxa_match_universe_payment_sms(
  p_partner uuid,p_transaction_reference text
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
  v_ref text:=upper(regexp_replace(trim(coalesce(p_transaction_reference,'')),'[^A-Za-z0-9]','','g'));
  v_intent_count integer:=0;
  v_event_count integer:=0;
  v_intent public.naxa_universe_payment_intents%rowtype;
  v_event public.naxa_payment_evidence_intake%rowtype;
  v_existing public.naxa_universe_payment_confirmations%rowtype;
  v_merchant_phone text;
  v_merchant_tail text;
  v_receipt text;
  m record;
begin
  if auth.role()<>'service_role' then raise exception 'Service interne NAXA requis'; end if;
  if p_partner is null or length(v_ref)<5 or length(v_ref)>120 then
    raise exception 'Partenaire ou ID de transaction invalide';
  end if;

  select count(*) into v_intent_count
  from public.naxa_universe_payment_intents i
  where i.partner_id=p_partner and i.status='submitted'
    and i.transaction_reference is not null
    and upper(regexp_replace(i.transaction_reference,'[^A-Za-z0-9]','','g'))=v_ref;
  if v_intent_count=0 then return jsonb_build_object('status','waiting_for_payer_declaration'); end if;
  if v_intent_count>1 then
    update public.universe_reservations r set payment_status='manual_review',updated_at=now()
    where r.id in (
      select i.reservation_id from public.naxa_universe_payment_intents i
      where i.partner_id=p_partner and i.status='submitted'
        and upper(regexp_replace(coalesce(i.transaction_reference,''),'[^A-Za-z0-9]','','g'))=v_ref
    );
    return jsonb_build_object('status','ambiguous_payment_reference');
  end if;

  select * into v_intent
  from public.naxa_universe_payment_intents i
  where i.partner_id=p_partner and i.status='submitted'
    and upper(regexp_replace(coalesce(i.transaction_reference,''),'[^A-Za-z0-9]','','g'))=v_ref
  for update;

  select * into v_existing from public.naxa_universe_payment_confirmations c
  where c.payment_intent_id=v_intent.id limit 1;
  if found then
    return jsonb_build_object('status','financially_confirmed','receipt_number',v_existing.receipt_number,
      'confirmation_id',v_existing.id,'confirmed_at',v_existing.confirmed_at);
  end if;

  if v_intent.proof_source<>'shared_sms'
     or v_intent.payer_sms_sha256 is null
     or v_intent.payer_sms_sha256 !~ '^[0-9a-f]{64}$'
     or v_intent.declared_amount is distinct from v_intent.expected_amount then
    update public.universe_reservations set payment_status='manual_review',updated_at=now()
    where id=v_intent.reservation_id;
    return jsonb_build_object('status','payer_sms_incomplete_or_mismatched');
  end if;

  select count(*) into v_event_count
  from public.naxa_payment_evidence_intake e
  where e.workspace_type='partner' and e.workspace_id=p_partner
    and e.canal=v_intent.canal and e.source_type='sms_receiver'
    and e.direction='merchant_credit' and e.success=true
    and e.match_status in ('manual_review','coherent_unconfirmed')
    and e.transaction_reference is not null
    and upper(regexp_replace(e.transaction_reference,'[^A-Za-z0-9]','','g'))=v_ref;
  if v_event_count=0 then
    return jsonb_build_object('status','waiting_for_merchant_sms');
  end if;
  if v_event_count>1 then
    update public.universe_reservations set payment_status='manual_review',updated_at=now()
    where id=v_intent.reservation_id;
    return jsonb_build_object('status','ambiguous_merchant_sms');
  end if;

  select * into v_event
  from public.naxa_payment_evidence_intake e
  where e.workspace_type='partner' and e.workspace_id=p_partner
    and e.canal=v_intent.canal and e.source_type='sms_receiver'
    and e.direction='merchant_credit' and e.success=true
    and e.match_status in ('manual_review','coherent_unconfirmed')
    and upper(regexp_replace(coalesce(e.transaction_reference,''),'[^A-Za-z0-9]','','g'))=v_ref
  for update;

  if v_event.amount is distinct from v_intent.expected_amount
     or v_event.source_payload_sha256=v_intent.payer_sms_sha256
     or (v_event.payer_number_tail is not null and v_intent.payer_number_tail is not null
       and v_event.payer_number_tail<>v_intent.payer_number_tail) then
    update public.universe_reservations set payment_status='manual_review',updated_at=now()
    where id=v_intent.reservation_id;
    return jsonb_build_object('status','merchant_sms_details_mismatch');
  end if;

  v_merchant_phone:=v_intent.destination_snapshot->>'merchant_phone';
  if v_intent.destination_snapshot->>'merchant_code' !~ '^[0-9]{6}$'
     or length(regexp_replace(coalesce(v_merchant_phone,''),'[^0-9]','','g')) not between 8 and 15 then
    update public.universe_reservations set payment_status='manual_review',updated_at=now()
    where id=v_intent.reservation_id;
    return jsonb_build_object('status','merchant_destination_snapshot_invalid');
  end if;

  v_merchant_tail:=right(regexp_replace(coalesce(v_merchant_phone,''),'[^0-9]','','g'),9);
  if v_event.merchant_number_tail is not null and length(v_merchant_tail)>=8
     and v_event.merchant_number_tail<>v_merchant_tail then
    update public.universe_reservations set payment_status='manual_review',updated_at=now()
    where id=v_intent.reservation_id;
    return jsonb_build_object('status','merchant_destination_mismatch');
  end if;

  if v_event.provider_occurred_at is not null and v_intent.payer_occurred_at is not null
     and abs(extract(epoch from (v_event.provider_occurred_at-v_intent.payer_occurred_at)))>86400 then
    update public.universe_reservations set payment_status='manual_review',updated_at=now()
    where id=v_intent.reservation_id;
    return jsonb_build_object('status','provider_timestamp_mismatch');
  end if;

  v_receipt:='NAXA-PAR-'||to_char(now() at time zone 'Africa/Douala','YYYYMMDD')||'-'||
    lpad(nextval('public.naxa_universe_payment_receipt_seq')::text,8,'0');

  insert into public.naxa_universe_payment_confirmations(
    receipt_number,payment_intent_id,reservation_id,merchant_evidence_id,
    partner_id,client_id,canal,transaction_reference,reference_normalisee,
    amount_fcfa,destination_snapshot,payer_sms_sha256,merchant_sms_sha256,
    payer_number_tail,merchant_number_tail,payer_occurred_at,payer_declared_at,
    merchant_occurred_at,merchant_received_at
  ) values (
    v_receipt,v_intent.id,v_intent.reservation_id,v_event.id,v_intent.partner_id,
    v_intent.client_id,v_intent.canal,v_intent.transaction_reference,v_ref,
    v_intent.expected_amount,v_intent.destination_snapshot,v_intent.payer_sms_sha256,
    v_event.source_payload_sha256,v_intent.payer_number_tail,v_event.merchant_number_tail,
    v_intent.payer_occurred_at,v_intent.payer_declared_at,v_event.provider_occurred_at,v_event.received_at
  ) returning * into v_existing;

  update public.naxa_universe_payment_intents
  set status='matched',matched_at=now(),updated_at=now()
  where id=v_intent.id;
  update public.naxa_payment_evidence_intake
  set match_status='coherent_confirmed'
  where id=v_event.id and match_status in ('manual_review','coherent_unconfirmed');
  update public.universe_reservations
  set payment_status='confirmed',updated_at=now()
  where id=v_intent.reservation_id;

  insert into public.notifications(user_id,type,titre,corps,reservation_id,related_entity_id)
  values(
    v_intent.client_id,'universe_payment_confirmed_sms','Paiement partenaire confirmé par NAXA',
    'Les SMS de débit et de crédit concordent. Reçu NAXA '||v_existing.receipt_number||
    ' · '||v_intent.expected_amount::text||' FCFA. Présentez le code de retrait au partenaire.',
    v_intent.reservation_id,v_existing.id
  );

  for m in
    select pm.user_id from public.partner_members pm
    where pm.partner_id=p_partner and pm.member_role in ('owner','manager','operator')
      and pm.user_id<>v_intent.client_id
  loop
    insert into public.notifications(user_id,type,titre,corps,reservation_id,related_entity_id)
    values(
      m.user_id,'universe_payment_confirmed_sms','Paiement confirmé · retrait autorisable',
      'NAXA a rapproché les SMS débit/crédit. Reçu '||v_existing.receipt_number||
      ' · '||v_intent.expected_amount::text||' FCFA. Le retrait peut être confirmé après contrôle du code de retrait.',
      v_intent.reservation_id,v_existing.id
    );
  end loop;

  return jsonb_build_object('status','financially_confirmed','receipt_number',v_existing.receipt_number,
    'confirmation_id',v_existing.id,'amount',v_intent.expected_amount,'confirmed_at',v_existing.confirmed_at);
end;
$function$;
revoke all on function public.naxa_match_universe_payment_sms(uuid,text) from public,anon,authenticated;
grant execute on function public.naxa_match_universe_payment_sms(uuid,text) to service_role;

create or replace function private.naxa_match_universe_payment_sms_on_arrival()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  if tg_table_name='naxa_universe_payment_intents' then
    if new.status='submitted' and new.transaction_reference is not null then
      perform public.naxa_match_universe_payment_sms(new.partner_id,new.transaction_reference);
    end if;
    return new;
  end if;
  if tg_table_name='naxa_payment_evidence_intake' then
    if new.workspace_type='partner' and new.source_type='sms_receiver'
       and new.direction='merchant_credit' and new.success is true
       and new.transaction_reference is not null then
      perform public.naxa_match_universe_payment_sms(new.workspace_id,new.transaction_reference);
    end if;
    return new;
  end if;
  return new;
end;
$function$;
revoke all on function private.naxa_match_universe_payment_sms_on_arrival() from public,anon,authenticated;
grant execute on function private.naxa_match_universe_payment_sms_on_arrival() to service_role;

drop trigger if exists trg_naxa_universe_payment_match_after_submission on public.naxa_universe_payment_intents;
create trigger trg_naxa_universe_payment_match_after_submission
after update of status,transaction_reference on public.naxa_universe_payment_intents
for each row execute function private.naxa_match_universe_payment_sms_on_arrival();

drop trigger if exists trg_naxa_partner_sms_match_after_credit on public.naxa_payment_evidence_intake;
create trigger trg_naxa_partner_sms_match_after_credit
after insert on public.naxa_payment_evidence_intake
for each row execute function private.naxa_match_universe_payment_sms_on_arrival();

create or replace function public.transition_universe_reservation(p_reservation_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public,extensions
as $function$
declare
  uid uuid := auth.uid();
  r public.universe_reservations%rowtype;
  it record;
  is_admin boolean;
  can_manage boolean;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select * into r from public.universe_reservations where id=p_reservation_id for update;
  if not found then raise exception 'Réservation introuvable'; end if;
  select exists(select 1 from public.profiles p where p.id=uid and p.role='admin') into is_admin;
  select exists(select 1 from public.partner_members pm where pm.partner_id=r.partner_id and pm.user_id=uid and pm.member_role in ('owner','manager','operator')) into can_manage;

  if p_status='cancelled' and r.client_id=uid and r.status in ('requested','confirmed') then
    update public.universe_reservations set status='cancelled',updated_at=now() where id=r.id;
    return;
  end if;
  if not (is_admin or can_manage) then raise exception 'Action non autorisée'; end if;
  if r.status in ('picked_up','cancelled','expired') then raise exception 'Réservation déjà clôturée'; end if;
  if p_status='confirmed' and r.status='requested' then
    update public.universe_reservations set status='confirmed',updated_at=now() where id=r.id;
  elsif p_status='ready' and r.status in ('requested','confirmed') then
    update public.universe_reservations set status='ready',updated_at=now() where id=r.id;
  elsif p_status='picked_up' and r.status='ready' then
    if r.payment_mode in ('orange_money','mtn_momo') and r.payment_status<>'confirmed' then
      raise exception 'Le paiement électronique doit être rapproché par les deux SMS avant le retrait';
    end if;
    for it in select ri.product_id,ri.quantity,pp.stock_quantity from public.universe_reservation_items ri
      join public.partner_products pp on pp.id=ri.product_id where ri.reservation_id=r.id order by ri.product_id for update of pp
    loop
      if it.stock_quantity < it.quantity then raise exception 'Stock physique insuffisant lors du retrait'; end if;
      update public.partner_products set stock_quantity=stock_quantity-it.quantity,updated_at=now() where id=it.product_id;
      insert into public.stock_movements(partner_id,product_id,quantity_delta,movement_type,reason,reference,created_by)
      values(r.partner_id,it.product_id,-it.quantity,'sale','Retrait confirmé',r.id::text,uid);
    end loop;
    update public.universe_reservations set status='picked_up',picked_up_at=now(),updated_at=now() where id=r.id;
  else
    raise exception 'Transition de statut non autorisée';
  end if;
end;
$function$;
revoke all on function public.transition_universe_reservation(uuid,text) from public,anon;
grant execute on function public.transition_universe_reservation(uuid,text) to authenticated;

create or replace function public.naxa_universe_cancel_payment_intent(
  p_reservation uuid,p_client uuid
) returns boolean language plpgsql security definer set search_path=''
as $function$
declare
  v_res public.universe_reservations%rowtype;
  v_intent public.naxa_universe_payment_intents%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'Service NAXA requis'; end if;
  if p_reservation is null or p_client is null then raise exception 'Réservation et Client requis'; end if;
  select * into v_res from public.universe_reservations where id=p_reservation for update;
  if not found or v_res.client_id<>p_client then raise exception 'Réservation introuvable pour ce Client'; end if;
  select * into v_intent from public.naxa_universe_payment_intents
  where reservation_id=p_reservation and status in ('active','submitted','matched')
  order by created_at desc limit 1 for update;
  if not found then
    if v_res.payment_mode is null and v_res.payment_status='not_required' then return true; end if;
    raise exception 'Aucune intention active annulable. Un SMS payeur a peut-être déjà été soumis.';
  end if;
  if v_intent.status<>'active' or v_res.payment_status<>'awaiting_payment' then
    raise exception 'Le SMS payeur a déjà été soumis ou le paiement est rapproché ; annulation automatique refusée.';
  end if;
  update public.naxa_universe_payment_intents set status='cancelled',updated_at=now()
  where id=v_intent.id and status='active';
  if not found then raise exception 'L''intention ne peut plus être annulée'; end if;
  update public.universe_reservations
  set payment_mode=null,payment_status='not_required',updated_at=now()
  where id=p_reservation;
  return true;
end;
$function$;
revoke all on function public.naxa_universe_cancel_payment_intent(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.naxa_universe_cancel_payment_intent(uuid,uuid) to service_role;

commit;
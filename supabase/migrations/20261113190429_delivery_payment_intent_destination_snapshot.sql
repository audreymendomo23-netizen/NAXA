begin;

create table if not exists public.naxa_delivery_payment_intents (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  client_id uuid not null references auth.users(id) on delete restrict,
  canal text not null check (canal in ('orange_money','mtn_momo')),
  expected_amount integer not null check (expected_amount > 0),
  destination_id uuid not null references public.naxa_merchant_payment_destinations(id) on delete restrict,
  destination_snapshot jsonb not null check (jsonb_typeof(destination_snapshot)='object'),
  status text not null default 'active'
    check (status in ('active','submitted','matched','expired','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  matched_at timestamptz,
  constraint naxa_delivery_payment_intents_expiry_ck check (expires_at > created_at)
);

create unique index if not exists naxa_delivery_payment_intents_active_uq
  on public.naxa_delivery_payment_intents(reservation_id, canal)
  where status='active';

create index if not exists naxa_delivery_payment_intents_reservation_idx
  on public.naxa_delivery_payment_intents(reservation_id, created_at desc);

alter table public.naxa_delivery_payment_intents enable row level security;
revoke all on public.naxa_delivery_payment_intents from public, anon, authenticated;
grant all on public.naxa_delivery_payment_intents to service_role;

alter table public.naxa_delivery_payment_records
  add column if not exists payment_intent_id uuid
  references public.naxa_delivery_payment_intents(id) on delete restrict;

create index if not exists naxa_delivery_payment_records_payment_intent_idx
  on public.naxa_delivery_payment_records(payment_intent_id)
  where payment_intent_id is not null;

create or replace function public.naxa_delivery_get_or_create_payment_intent(
  p_reservation uuid,
  p_client uuid,
  p_canal text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_res public.reservations%rowtype;
  v_destination public.naxa_merchant_payment_destinations%rowtype;
  v_intent public.naxa_delivery_payment_intents%rowtype;
  v_amount integer;
  v_expiry timestamptz;
  v_snapshot jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service NAXA requis';
  end if;
  if p_reservation is null or p_client is null
     or p_canal not in ('orange_money','mtn_momo') then
    raise exception 'Intention de paiement invalide';
  end if;

  select * into v_res
  from public.reservations r
  where r.id=p_reservation
  for update;
  if not found or v_res.client_id<>p_client or v_res.mode<>'commande'
     or v_res.livraison_confirmee_stock_at is null
     or v_res.commande_statut not in ('acceptee','preparation','livreur_assigne','en_livraison')
     or v_res.paiement_statut='effectue'
     or (case when v_res.paiement_mode='mtn_marchand' then 'mtn_momo'
              when v_res.paiement_mode='orange_money' then 'orange_money'
              else null end) is distinct from p_canal then
    raise exception 'Commande non éligible à cette intention de paiement';
  end if;

  v_amount := v_res.total + v_res.frais_livraison;
  if v_amount <= 0 then raise exception 'Montant attendu invalide'; end if;
  v_expiry := least(coalesce(v_res.expires_at, now()+interval '24 hours'), now()+interval '24 hours');
  if v_expiry <= now() then raise exception 'Commande expirée'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_reservation::text || ':' || p_canal, 0));

  select * into v_intent
  from public.naxa_delivery_payment_intents i
  where i.reservation_id=p_reservation
    and i.canal=p_canal
    and i.status in ('active','submitted','matched')
  order by i.created_at desc
  limit 1
  for update;

  if found then
    if v_intent.expected_amount<>v_amount or v_intent.pharmacie_id<>v_res.pharmacie_id
       or v_intent.client_id<>p_client then
      raise exception 'Intention existante incohérente avec la commande';
    end if;
    if v_intent.status in ('submitted','matched') then
      return jsonb_build_object(
        'id',v_intent.id,'canal',v_intent.canal,'expected_amount',v_intent.expected_amount,
        'destination_snapshot',v_intent.destination_snapshot,'status',v_intent.status,
        'expires_at',v_intent.expires_at
      );
    end if;
    if v_intent.status='active' and v_intent.expires_at>now() then
      return jsonb_build_object(
        'id',v_intent.id,'canal',v_intent.canal,'expected_amount',v_intent.expected_amount,
        'destination_snapshot',v_intent.destination_snapshot,'status',v_intent.status,
        'expires_at',v_intent.expires_at
      );
    end if;
    update public.naxa_delivery_payment_intents
    set status='expired',updated_at=now()
    where id=v_intent.id and status='active';
  end if;

  select * into v_destination
  from public.naxa_merchant_payment_destinations d
  where d.pharmacie_id=v_res.pharmacie_id
    and d.canal=p_canal and d.is_active=true
  limit 1;
  if not found or v_destination.merchant_code !~ '^[0-9]{6}$' then
    raise exception 'Coordonnées marchandes absentes ou invalides';
  end if;

  v_snapshot := jsonb_build_object(
    'destination_id',v_destination.id,
    'merchant_name',v_destination.merchant_name,
    'merchant_phone',v_destination.merchant_phone,
    'merchant_code',v_destination.merchant_code,
    'canal',v_destination.canal,
    'captured_at',now()
  );

  insert into public.naxa_delivery_payment_intents(
    reservation_id,pharmacie_id,client_id,canal,expected_amount,
    destination_id,destination_snapshot,status,expires_at
  ) values (
    p_reservation,v_res.pharmacie_id,p_client,p_canal,v_amount,
    v_destination.id,v_snapshot,'active',v_expiry
  ) returning * into v_intent;

  return jsonb_build_object(
    'id',v_intent.id,'canal',v_intent.canal,'expected_amount',v_intent.expected_amount,
    'destination_snapshot',v_intent.destination_snapshot,'status',v_intent.status,
    'expires_at',v_intent.expires_at
  );
end;
$function$;

revoke all on function public.naxa_delivery_get_or_create_payment_intent(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.naxa_delivery_get_or_create_payment_intent(uuid,uuid,text)
  to service_role;

create or replace function public.naxa_client_declarer_paiement_livraison_v2(
  p_reservation uuid,
  p_client uuid,
  p_reference text,
  p_payer_number text,
  p_declared_amount integer,
  p_payment_occurred_at timestamptz,
  p_proof_source text,
  p_field_sources jsonb default '{}'::jsonb,
  p_sms_payload_sha256 text default null
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_r public.reservations%rowtype;
  v_reference text:=trim(coalesce(p_reference,''));
  v_now timestamptz:=now();
  v_channel text;
  v_intent public.naxa_delivery_payment_intents%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'Service NAXA requis'; end if;
  if p_client is null or p_reservation is null then raise exception 'Client et commande requis'; end if;
  if length(v_reference)<5 or length(v_reference)>120
    or v_reference !~ '^[[:alnum:][:space:]_./-]+$' then
    raise exception 'Référence de paiement invalide';
  end if;
  if p_declared_amount is null or p_declared_amount<=0 then raise exception 'Montant déclaré invalide'; end if;
  if p_proof_source not in ('shared_sms','manual_entry') then raise exception 'Provenance de preuve invalide'; end if;
  if p_payment_occurred_at is null or p_payment_occurred_at>v_now+interval '5 minutes'
     or p_payment_occurred_at<v_now-interval '7 days' then
    raise exception 'Date de paiement hors de la fenêtre autorisée';
  end if;
  if p_payer_number is not null and (
    length(regexp_replace(p_payer_number,'[^0-9]','','g'))<8
    or length(regexp_replace(p_payer_number,'[^0-9]','','g'))>15
  ) then raise exception 'Numéro payeur invalide'; end if;
  if p_sms_payload_sha256 is not null and p_sms_payload_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Empreinte SMS invalide';
  end if;

  select * into v_r from public.reservations where id=p_reservation for update;
  if not found or v_r.client_id<>p_client or v_r.mode<>'commande'
    or v_r.livraison_confirmee_stock_at is null
    or v_r.paiement_mode not in ('mtn_marchand','orange_money')
    or v_r.commande_statut not in ('acceptee','preparation','livreur_assigne','en_livraison')
    or v_r.paiement_statut='effectue' then
    raise exception 'La commande ne permet pas cette déclaration de paiement';
  end if;
  if exists(select 1 from public.reservations r
    where r.pharmacie_id=v_r.pharmacie_id and r.paiement_ref=v_reference and r.id<>v_r.id) then
    raise exception 'Cette référence a déjà été utilisée dans cette pharmacie';
  end if;

  v_channel:=case when v_r.paiement_mode='mtn_marchand' then 'mtn_momo' else 'orange_money' end;
  select * into v_intent
  from public.naxa_delivery_payment_intents i
  where i.reservation_id=v_r.id and i.canal=v_channel
    and i.status='active' and i.expires_at>v_now
  order by i.created_at desc limit 1
  for update;

  if found and (
    v_intent.expected_amount<>(v_r.total+v_r.frais_livraison)
    or v_intent.pharmacie_id<>v_r.pharmacie_id
    or v_intent.client_id<>p_client
  ) then
    raise exception 'Instantané de paiement différent de la commande';
  end if;

  update public.reservations
    set paiement_ref=v_reference,paiement_statut='a_verifier'
    where id=v_r.id;

  insert into public.naxa_delivery_payment_records(
    reservation_id,pharmacie_id,client_id,mode,expected_amount,reference,
    payer_number,declared_amount,payment_occurred_at,proof_source,field_sources,
    sms_payload_sha256,payment_intent_id,status,declared_by,declared_at
  ) values (
    v_r.id,v_r.pharmacie_id,p_client,v_r.paiement_mode,
    v_r.total+v_r.frais_livraison,v_reference,
    nullif(trim(coalesce(p_payer_number,'')),''),p_declared_amount,p_payment_occurred_at,
    p_proof_source,case when jsonb_typeof(coalesce(p_field_sources,'{}'::jsonb))='object'
      then coalesce(p_field_sources,'{}'::jsonb) else '{}'::jsonb end,
    p_sms_payload_sha256,v_intent.id,'declared',p_client,v_now
  )
  on conflict(reservation_id) do update
    set mode=excluded.mode,expected_amount=excluded.expected_amount,reference=excluded.reference,
        payer_number=excluded.payer_number,declared_amount=excluded.declared_amount,
        payment_occurred_at=excluded.payment_occurred_at,proof_source=excluded.proof_source,
        field_sources=excluded.field_sources,sms_payload_sha256=excluded.sms_payload_sha256,
        payment_intent_id=excluded.payment_intent_id,
        status='declared',declared_by=p_client,declared_at=v_now,
        cash_received=null,cash_change=0,validated_by=null,validated_at=null,
        caisse_session_id=null,vente_id=null,rejection_reason=null,updated_at=v_now
    where public.naxa_delivery_payment_records.status<>'paid';

  if not found then raise exception 'Un paiement a déjà été validé pour cette commande'; end if;

  if v_intent.id is not null then
    update public.naxa_delivery_payment_intents
    set status='submitted',submitted_at=coalesce(submitted_at,v_now),updated_at=v_now
    where id=v_intent.id and status='active';
  end if;

  insert into public.notifications(pharmacie_id,type,titre,corps,reservation_id)
  values(v_r.pharmacie_id,'delivery_payment_declared','Paiement de livraison à rapprocher',
    'Le Client a transmis une déclaration. NAXA rapproche automatiquement son SMS de débit avec le SMS de crédit marchand reçu sur un téléphone Pharmacie. Si les preuves concordent, elles seront marquées comme rapprochées ; sinon le dossier restera à vérifier.',
    v_r.id);
  return true;
end;
$function$;

revoke all on function public.naxa_client_declarer_paiement_livraison_v2(uuid,uuid,text,text,integer,timestamptz,text,jsonb,text)
  from public,anon,authenticated;
grant execute on function public.naxa_client_declarer_paiement_livraison_v2(uuid,uuid,text,text,integer,timestamptz,text,jsonb,text)
  to service_role;

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

  if v_record.payment_intent_id is not null then
    select * into v_intent
    from public.naxa_delivery_payment_intents i
    where i.id=v_record.payment_intent_id
      and i.reservation_id=v_record.reservation_id
      and i.pharmacie_id=p_pharmacie
      and i.canal=v_channel
      and i.expected_amount=v_record.expected_amount
      and i.status in ('submitted','matched')
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
  else
    select count(*) into v_destination_count
    from public.naxa_merchant_payment_destinations d
    where d.pharmacie_id=p_pharmacie and d.canal=v_channel and d.is_active=true;
    select d.merchant_phone into v_merchant_phone
    from public.naxa_merchant_payment_destinations d
    where d.pharmacie_id=p_pharmacie and d.canal=v_channel and d.is_active=true limit 1;
  end if;

  if v_destination_count<>1 then
    update public.naxa_delivery_payment_records set sms_match_status='manual_review',updated_at=now()
    where id=v_record.id;
    return jsonb_build_object('status','merchant_destination_ambiguous_or_missing','payment_record_id',v_record.id);
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
  if v_record.payment_intent_id is not null then
    update public.naxa_delivery_payment_intents
    set status='matched',matched_at=now(),updated_at=now()
    where id=v_record.payment_intent_id and status='submitted';
  end if;

  return jsonb_build_object('status','matched_waiting_pos','payment_record_id',v_record.id,
    'merchant_evidence_id',v_event.id,'transaction_reference',v_ref,
    'amount',v_record.expected_amount,'matched_at',now());
end;
$function$;

revoke all on function public.naxa_match_delivery_payment_sms(uuid,text) from public,anon,authenticated;
grant execute on function public.naxa_match_delivery_payment_sms(uuid,text) to service_role;

commit;

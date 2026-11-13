begin;

alter table public.naxa_delivery_payment_records
 add column if not exists sms_match_status text not null default 'not_checked',
 add column if not exists merchant_sms_evidence_id uuid,
 add column if not exists sms_matched_at timestamptz;

do $$
begin
 if not exists(select 1 from pg_constraint where conrelid='public.naxa_delivery_payment_records'::regclass and conname='naxa_delivery_payment_sms_match_status_ck') then
  alter table public.naxa_delivery_payment_records add constraint naxa_delivery_payment_sms_match_status_ck
  check(sms_match_status in ('not_checked','awaiting_merchant_sms','matched','manual_review','not_applicable'));
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.naxa_delivery_payment_records'::regclass and conname='naxa_delivery_merchant_sms_evidence_fk') then
  alter table public.naxa_delivery_payment_records add constraint naxa_delivery_merchant_sms_evidence_fk
  foreign key(merchant_sms_evidence_id) references public.naxa_payment_evidence_intake(id) on delete restrict;
 end if;
end $$;

create unique index if not exists naxa_delivery_payment_merchant_sms_evidence_unique
 on public.naxa_delivery_payment_records(merchant_sms_evidence_id) where merchant_sms_evidence_id is not null;
create index if not exists naxa_delivery_payment_sms_match_idx
 on public.naxa_delivery_payment_records(pharmacie_id,sms_match_status,reference);

CREATE OR REPLACE FUNCTION public.naxa_match_delivery_payment_sms(
  p_pharmacie uuid,
  p_transaction_reference text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_ref text := upper(regexp_replace(trim(coalesce(p_transaction_reference,'')), '[^A-Za-z0-9]', '', 'g'));
  v_record_count integer := 0;
  v_event_count integer := 0;
  v_destination_count integer := 0;
  v_record public.naxa_delivery_payment_records%rowtype;
  v_event public.naxa_payment_evidence_intake%rowtype;
  v_channel text;
  v_merchant_phone text;
  v_payer_tail text;
  v_merchant_tail text;
BEGIN
  if auth.role() <> 'service_role' then raise exception 'Service interne NAXA requis'; end if;
  if p_pharmacie is null or length(v_ref) < 5 or length(v_ref) > 120 then
    raise exception 'Pharmacie ou ID de transaction invalide';
  end if;

  select count(*) into v_record_count from public.naxa_delivery_payment_records pr
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

  select * into v_record from public.naxa_delivery_payment_records pr
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
     or v_record.payer_number is null
     or length(regexp_replace(v_record.payer_number,'[^0-9]','','g'))<8 then
    update public.naxa_delivery_payment_records set sms_match_status='manual_review',updated_at=now()
    where id=v_record.id;
    return jsonb_build_object('status','payer_sms_incomplete_or_mismatched','payment_record_id',v_record.id);
  end if;

  v_channel:=case when v_record.mode='mtn_marchand' then 'mtn_momo' else 'orange_money' end;
  v_payer_tail:=right(regexp_replace(v_record.payer_number,'[^0-9]','','g'),9);

  select count(*) into v_event_count from public.naxa_payment_evidence_intake e
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

  select * into v_event from public.naxa_payment_evidence_intake e
  where e.workspace_type='pharmacie' and e.workspace_id=p_pharmacie
    and e.canal=v_channel and e.source_type='sms_receiver'
    and e.direction='merchant_credit' and e.success=true
    and e.match_status='manual_review' and e.transaction_reference is not null
    and upper(regexp_replace(e.transaction_reference,'[^A-Za-z0-9]','','g'))=v_ref
  for update;

  if v_event.amount is distinct from v_record.expected_amount
     or v_event.source_payload_sha256=v_record.sms_payload_sha256
     or v_event.payer_number_tail is null
     or v_event.payer_number_tail<>v_payer_tail then
    update public.naxa_delivery_payment_records set sms_match_status='manual_review',updated_at=now()
    where id=v_record.id;
    return jsonb_build_object('status','merchant_sms_details_mismatch','payment_record_id',v_record.id);
  end if;

  select count(*) into v_destination_count from public.naxa_merchant_payment_destinations d
  where d.pharmacie_id=p_pharmacie and d.canal=v_channel and d.is_active=true;
  if v_destination_count<>1 then
    update public.naxa_delivery_payment_records set sms_match_status='manual_review',updated_at=now()
    where id=v_record.id;
    return jsonb_build_object('status','merchant_destination_ambiguous_or_missing','payment_record_id',v_record.id);
  end if;
  select d.merchant_phone into v_merchant_phone from public.naxa_merchant_payment_destinations d
  where d.pharmacie_id=p_pharmacie and d.canal=v_channel and d.is_active=true limit 1;
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

  return jsonb_build_object('status','matched_waiting_pos','payment_record_id',v_record.id,
    'merchant_evidence_id',v_event.id,'transaction_reference',v_ref,
    'amount',v_record.expected_amount,'matched_at',now());
END;
$function$;

revoke all on function public.naxa_match_delivery_payment_sms(uuid,text) from public,anon,authenticated;
grant execute on function public.naxa_match_delivery_payment_sms(uuid,text) to service_role;

CREATE OR REPLACE FUNCTION public.naxa_client_declarer_paiement_livraison_v2(p_reservation uuid, p_client uuid, p_reference text, p_payer_number text, p_declared_amount integer, p_payment_occurred_at timestamp with time zone, p_proof_source text, p_field_sources jsonb DEFAULT '{}'::jsonb, p_sms_payload_sha256 text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_r public.reservations%rowtype;
  v_reference text:=trim(coalesce(p_reference,''));
  v_now timestamptz:=now();
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

  if exists(
    select 1 from public.naxa_delivery_payment_records pr
    where pr.reservation_id=v_r.id and pr.status='declared'
      and pr.sms_match_status='matched'
  ) then
    raise exception 'Les deux SMS ont déjà été rapprochés. La Caisse doit émettre le ticket POS.';
  end if;

  update public.reservations
    set paiement_ref=v_reference,paiement_statut='a_verifier'
    where id=v_r.id;

  insert into public.naxa_delivery_payment_records(
    reservation_id,pharmacie_id,client_id,mode,expected_amount,reference,
    payer_number,declared_amount,payment_occurred_at,proof_source,field_sources,
    sms_payload_sha256,status,declared_by,declared_at
  ) values (
    v_r.id,v_r.pharmacie_id,p_client,v_r.paiement_mode,
    v_r.total+v_r.frais_livraison,v_reference,
    nullif(trim(coalesce(p_payer_number,'')),''),p_declared_amount,p_payment_occurred_at,
    p_proof_source,case when jsonb_typeof(coalesce(p_field_sources,'{}'::jsonb))='object'
      then coalesce(p_field_sources,'{}'::jsonb) else '{}'::jsonb end,
    p_sms_payload_sha256,'declared',p_client,v_now
  )
  on conflict(reservation_id) do update
    set mode=excluded.mode,expected_amount=excluded.expected_amount,reference=excluded.reference,
        payer_number=excluded.payer_number,declared_amount=excluded.declared_amount,
        payment_occurred_at=excluded.payment_occurred_at,proof_source=excluded.proof_source,
        field_sources=excluded.field_sources,sms_payload_sha256=excluded.sms_payload_sha256,
        status='declared',declared_by=p_client,declared_at=v_now,
        cash_received=null,cash_change=0,validated_by=null,validated_at=null,
        caisse_session_id=null,vente_id=null,rejection_reason=null,
        sms_match_status='not_checked',merchant_sms_evidence_id=null,sms_matched_at=null,
        updated_at=v_now
    where public.naxa_delivery_payment_records.status<>'paid';

  if not found then raise exception 'Un paiement a déjà été validé pour cette commande'; end if;
  insert into public.notifications(pharmacie_id,type,titre,corps,reservation_id)
  values(v_r.pharmacie_id,'delivery_payment_declared','Paiement de livraison à vérifier',
    'Le client a transmis une déclaration de paiement. Vérifiez le crédit réellement reçu dans votre compte marchand avant validation.',
    v_r.id);
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.naxa_delivery_pending_payment_list_v2(p_pharmacie uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_result jsonb;
begin
  if v_uid is null or not public.naxa_caisse_actor_for_pharmacy(p_pharmacie) then
    raise exception 'La liste des paiements est réservée à la Caisse active de cette pharmacie';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'reservation_id',r.id,
    'mission_id',m.id,
    'reference_code',r.code_paiement,
    'client_id',r.client_id,
    'client_phone',r.telephone_livraison,
    'mode',r.paiement_mode,
    'reference',coalesce(pr.reference,r.paiement_ref),
    'expected_amount',r.total+r.frais_livraison,
    'declared_amount',pr.declared_amount,
    'payer_number',pr.payer_number,
    'payment_occurred_at',pr.payment_occurred_at,
    'proof_source',pr.proof_source,
    'field_sources',pr.field_sources,
    'sms_match_status',coalesce(pr.sms_match_status,'not_checked'),
    'sms_matched_at',pr.sms_matched_at,
    'sms_match_status',coalesce(pr.sms_match_status,'not_checked'),
    'sms_matched_at',pr.sms_matched_at,
    'cash_received',pr.cash_received,
    'cash_change',pr.cash_change,
    'payment_status',coalesce(pr.status,'declared'),
    'created_at',r.livraison_paiement_demande_at,
    'livreur_id',m.livreur_id
  ) order by r.livraison_paiement_demande_at),'[]'::jsonb)
  into v_result
  from public.reservations r
  left join public.naxa_delivery_missions m on m.reservation_id=r.id
  left join public.naxa_delivery_payment_records pr on pr.reservation_id=r.id
  where r.pharmacie_id=p_pharmacie and r.mode='commande'
    and r.livraison_confirmee_stock_at is not null
    and r.paiement_statut<>'effectue'
    and r.commande_statut in ('acceptee','preparation','livreur_assigne','en_livraison')
    and (
      (r.paiement_mode in ('mtn_marchand','orange_money') and pr.status='declared')
      or (r.paiement_mode='especes_livraison' and pr.status='cash_declared')
    );
  return v_result;
end;
$function$
;

commit;
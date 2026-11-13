-- Distinct payer-debit and merchant-credit SMS evidence under the same transaction ID.
-- Sender labels are used only to filter the collection stream.
begin;

create table if not exists public.naxa_promoteur_payment_sms_evidence (
  id uuid primary key default gen_random_uuid(),
  reglement_id uuid not null references public.abonnement_promoteur_reglements(id) on delete restrict,
  reference_claim_id uuid not null references public.naxa_promoteur_payment_reference_claims(id) on delete restrict,
  canal text not null check (canal in ('orange_money','mtn_momo')),
  source_level smallint not null check (source_level in (1,2)),
  source_type text not null check (source_type in ('payer_sms','merchant_sms')),
  transaction_reference text not null check (length(trim(transaction_reference)) between 5 and 160),
  reference_normalisee text generated always as (
    nullif(upper(regexp_replace(coalesce(transaction_reference,''), '[^A-Za-z0-9]', '', 'g')), '')
  ) stored,
  provider_occurred_at timestamptz,
  sms_received_at timestamptz,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  constraint naxa_promoteur_sms_evidence_source_level_ck
    check ((source_type='payer_sms' and source_level=1) or (source_type='merchant_sms' and source_level=2)),
  constraint naxa_promoteur_sms_evidence_unique_source unique (reglement_id, source_type),
  constraint naxa_promoteur_sms_evidence_claim_unique_source unique (reference_claim_id, source_type)
);

create index if not exists naxa_promoteur_sms_evidence_reference_idx
  on public.naxa_promoteur_payment_sms_evidence (reference_normalisee, canal, source_type);

alter table public.naxa_promoteur_payment_sms_evidence enable row level security;
revoke all on table public.naxa_promoteur_payment_sms_evidence from public, anon, authenticated;
grant select, insert, update, delete on table public.naxa_promoteur_payment_sms_evidence to service_role;

comment on table public.naxa_promoteur_payment_sms_evidence is
  'Deux preuves SMS distinctes debit payeur et credit marchand sous le meme ID transaction. SMS brut non conserve. Libelle expediteur filtre seulement le flux.';

CREATE OR REPLACE FUNCTION public.promoteur_soumettre_reglement(p_promoteur uuid, p_montant integer, p_canal text, p_canal_autre text, p_compte_payeur text, p_reference text, p_paye_le timestamp with time zone, p_preuve_path text, p_verification_details jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_abonnement public.abonnements_promoteurs%rowtype;
  v_convention public.conventions_promoteurs%rowtype;
  v_id uuid;
  v_claim_id uuid;
  v_admin record;
  v_canal_label text;
  v_promoteur_label text;
  v_destination jsonb;
  v_declared_at timestamptz := clock_timestamp();
  v_details jsonb := case
    when jsonb_typeof(coalesce(p_verification_details,'{}'::jsonb))='object'
    then coalesce(p_verification_details,'{}'::jsonb) else '{}'::jsonb end;
  v_level smallint;
  v_analysis_status text;
  v_reference_normalisee text;
  v_sms_hash text;
begin
  if p_promoteur is null or not exists (
    select 1 from public.profiles where id=p_promoteur and role::text='promoteur'
  ) then raise exception 'Promoteur introuvable'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'Montant invalide'; end if;
  if p_canal not in ('orange_money','mtn_momo') then
    raise exception 'Seuls Orange Money et MTN Mobile Money sont autorises pour un abonnement Promoteur';
  end if;
  if length(trim(coalesce(p_compte_payeur,''))) < 3 or length(trim(p_compte_payeur)) > 120 then
    raise exception 'Numero du payeur obligatoire';
  end if;
  if nullif(trim(coalesce(p_reference,'')),'') is null or length(trim(p_reference)) > 160 then
    raise exception 'Reference de transaction obligatoire';
  end if;
  if p_paye_le is null or p_paye_le > v_declared_at + interval '5 minutes'
     or p_paye_le < v_declared_at - interval '24 hours' then
    raise exception 'Date et heure reelles du paiement hors de la fenetre des dernieres 24 heures';
  end if;
  if p_preuve_path is not null and p_preuve_path !~ (
    '^' || p_promoteur::text || '/[0-9a-fA-F-]+\.(pdf|jpg|jpeg|png|webp)$'
  ) then raise exception 'Chemin de preuve invalide'; end if;

  select * into v_abonnement from public.abonnements_promoteurs
  where promoteur_id=p_promoteur for update;
  if not found then raise exception 'Abonnement Promoteur introuvable'; end if;
  select * into v_convention from public.conventions_promoteurs
  where id=v_abonnement.convention_id and promoteur_id=p_promoteur for update;
  if not found then raise exception 'Convention Promoteur introuvable'; end if;
  if p_montant <> v_abonnement.montant_mensuel or p_montant <> v_convention.montant_mensuel then
    raise exception 'Montant different du tarif mensuel conventionne';
  end if;
  if exists(select 1 from public.abonnement_promoteur_reglements
    where promoteur_id=p_promoteur and statut in ('en_attente','non_confirme')) then
    raise exception 'Un reglement est deja en attente pour ce Promoteur';
  end if;

  v_reference_normalisee := upper(regexp_replace(trim(p_reference), '[^A-Za-z0-9]', '', 'g'));
  if exists (
    select 1 from public.naxa_promoteur_payment_reference_claims
    where reference_normalisee=v_reference_normalisee
  ) then raise exception 'Cette reference de transaction a deja ete utilisee dans NAXA'; end if;

  select jsonb_build_object(
    'canal',d.canal,'beneficiaire',d.beneficiaire,
    'reference_destination',d.reference_destination,'instructions',d.instructions,'updated_at',d.updated_at
  ) into v_destination
  from public.naxa_payment_destinations d
  where d.canal=p_canal and d.actif=true for share;
  if v_destination is null then raise exception 'Destination de paiement non configuree ou inactive'; end if;

  select coalesce(nullif(trim(concat_ws(' ',first_name,last_name)),''),nullif(username,''),p_promoteur::text)
  into v_promoteur_label from public.profiles where id=p_promoteur;

  v_level := case when (v_details->>'level') in ('1','2','3') then (v_details->>'level')::smallint else 3 end;
  v_analysis_status := case
    when v_details->>'status' in ('coherent_needs_operator_confirmation','manual_review','invalid')
    then v_details->>'status' else 'manual_review' end;

  if v_level = 1 then
    v_sms_hash := coalesce(v_details->>'smsPayloadSha256','');
    if v_details->>'source' <> 'promoter_voluntary_sms_share'
       or v_details->>'sourceType' <> 'voluntary_sms_share'
       or v_details->>'direction' <> 'payer_debit'
       or v_details->>'success' <> 'true'
       or coalesce(v_details->>'amount','') !~ '^[0-9]+$'
       or (v_details->>'amount')::integer <> p_montant
       or upper(regexp_replace(coalesce(v_details->>'extractedReference',''), '[^A-Za-z0-9]', '', 'g')) <> v_reference_normalisee
       or v_sms_hash !~ '^[0-9a-f]{64}$' then
      raise exception 'Preuve SMS de debit invalide ou incoherente avec la reference declaree';
    end if;
  end if;

  insert into public.abonnement_promoteur_reglements(
    promoteur_id,abonnement_id,montant,canal,canal_autre,compte_payeur,reference,
    paye_le,preuve_path,enregistre_par,destination_snapshot,destination_snapshot_at,
    declared_at,verification_deadline_at,verification_level,verification_status,verification_details
  ) values (
    p_promoteur,v_abonnement.id,p_montant,p_canal,null,trim(p_compte_payeur),trim(p_reference),
    p_paye_le,p_preuve_path,p_promoteur,v_destination,v_declared_at,v_declared_at,
    v_declared_at+interval '24 hours',v_level,v_analysis_status,v_details
  ) returning id into v_id;

  insert into public.naxa_promoteur_payment_reference_claims(
    reglement_id,canal,transaction_reference,source_level,source_type,provider_occurred_at,sms_received_at
  ) values (
    v_id,p_canal,trim(p_reference),v_level,
    case when v_level=1 then 'payer_sms' when v_level=2 then 'merchant_sms' else 'promoter_submission' end,
    nullif(v_details->>'providerOccurredAt','')::timestamptz,
    nullif(v_details->>'smsReceivedAt','')::timestamptz
  ) returning id into v_claim_id;

  if v_level = 1 then
    insert into public.naxa_promoteur_payment_sms_evidence(
      reglement_id,reference_claim_id,canal,source_level,source_type,
      transaction_reference,provider_occurred_at,sms_received_at,payload_sha256
    ) values (
      v_id,v_claim_id,p_canal,1,'payer_sms',trim(p_reference),
      nullif(v_details->>'providerOccurredAt','')::timestamptz,
      nullif(v_details->>'smsReceivedAt','')::timestamptz,
      v_sms_hash
    );
  end if;

  v_canal_label := case p_canal when 'orange_money' then 'Orange Money' else 'MTN Mobile Money' end;
  for v_admin in select id from public.profiles where role::text='admin' and actif=true loop
    insert into public.notifications(user_id,type,titre,corps)
    values (
      v_admin.id,'abonnement_reglement_a_verifier','Paiement Promoteur a verifier',
      left(v_promoteur_label || ' a declare ' || p_montant::text || ' FCFA via ' || v_canal_label ||
        '. Compte payeur : ' || trim(p_compte_payeur) || '. Reference : ' || trim(p_reference) ||
        '. Paiement declare : ' || to_char(p_paye_le at time zone 'Africa/Douala','DD/MM/YYYY HH24:MI') ||
        '. Echeance de verification : ' || to_char((v_declared_at+interval '24 hours') at time zone 'Africa/Douala','DD/MM/YYYY HH24:MI') ||
        '. Analysez les elements et confirmez uniquement apres controle de l''encaissement.',1000)
    );
  end loop;
  insert into public.notifications(user_id,type,titre,corps)
  values (
    p_promoteur,'abonnement_reglement_soumis','Paiement transmis a NAXA',
    'Votre declaration est en cours de verification pendant 24 heures. Ce delai ne confirme pas le paiement et ne renouvelle pas encore votre abonnement.'
  );
  return v_id;
end;
$function$


revoke all on function public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text,jsonb) from public,anon,authenticated;
grant execute on function public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text,jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.naxa_promoteur_payment_add_reference(p_reglement uuid, p_canal text, p_reference text, p_source_level smallint, p_source_type text, p_provider_occurred_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_sms_received_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_payload_sha256 text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r public.abonnement_promoteur_reglements%rowtype;
  v_reference text := upper(regexp_replace(trim(coalesce(p_reference,'')), '[^A-Za-z0-9]', '', 'g'));
  v_claim_id uuid;
  v_evidence_id uuid;
  v_existing_hash text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service interne NAXA requis';
  end if;
  if p_reglement is null or p_canal not in ('orange_money','mtn_momo')
     or p_source_level not in (1,2,3)
     or p_source_type not in ('payer_sms','merchant_sms','promoter_submission')
     or length(v_reference) < 5 or length(v_reference) > 160 then
    raise exception 'Reference ou source de paiement invalide';
  end if;
  select * into r from public.abonnement_promoteur_reglements
  where id=p_reglement for update;
  if not found or r.statut <> 'en_attente' then
    raise exception 'Reglement absent ou deja traite';
  end if;
  if r.canal <> p_canal or r.verification_deadline_at <= now() then
    raise exception 'Canal incorrect ou delai de verification expire';
  end if;
  if p_provider_occurred_at is not null
     and (p_provider_occurred_at > now() + interval '5 minutes'
       or p_provider_occurred_at < r.paye_le - interval '15 minutes'
       or p_provider_occurred_at > r.paye_le + interval '30 minutes') then
    raise exception 'Horodatage operateur incoherent avec le paiement declare';
  end if;
  if p_sms_received_at is not null
     and (p_sms_received_at > now() + interval '5 minutes'
       or p_sms_received_at < r.declared_at - interval '5 minutes'
       or p_sms_received_at > r.verification_deadline_at) then
    raise exception 'Horodatage de reception SMS hors de la fenetre autorisee';
  end if;

  if p_source_type='merchant_sms' and p_source_level=2 then
    select id into v_claim_id
    from public.naxa_promoteur_payment_reference_claims
    where reglement_id=r.id and canal=p_canal and reference_normalisee=v_reference
    for update;
    if v_claim_id is null then
      raise exception 'L ID de transaction du SMS de credit ne correspond pas a celui du SMS de debit du payeur';
    end if;

    select id,payload_sha256 into v_evidence_id,v_existing_hash
    from public.naxa_promoteur_payment_sms_evidence
    where reglement_id=r.id and source_type='merchant_sms'
    for update;
    if v_evidence_id is not null then
      if v_existing_hash is not distinct from p_payload_sha256 then return v_evidence_id; end if;
      raise exception 'Une autre preuve SMS de credit est deja rattachee a ce reglement';
    end if;

    if p_payload_sha256 is null or p_payload_sha256 !~ '^[0-9a-f]{64}$' then
      raise exception 'Empreinte du SMS de credit invalide';
    end if;

    insert into public.naxa_promoteur_payment_sms_evidence(
      reglement_id,reference_claim_id,canal,source_level,source_type,
      transaction_reference,provider_occurred_at,sms_received_at,payload_sha256
    ) values (
      r.id,v_claim_id,p_canal,2,'merchant_sms',trim(p_reference),
      p_provider_occurred_at,p_sms_received_at,p_payload_sha256
    ) returning id into v_evidence_id;

    update public.abonnement_promoteur_reglements
    set verification_level=greatest(verification_level,2),
        verification_details=verification_details || jsonb_build_object(
          'merchantSmsEvidenceStored',true,'merchantSmsEvidenceId',v_evidence_id,
          'merchantSmsReferenceMatchedToPayer',true,'updatedAt',now()
        ),
        updated_at=now()
    where id=r.id;
    return v_evidence_id;
  end if;

  select id into v_claim_id from public.naxa_promoteur_payment_reference_claims
  where reference_normalisee=v_reference and reglement_id=r.id;
  if v_claim_id is not null then return v_claim_id; end if;

  if exists (
    select 1 from public.abonnement_promoteur_reglements existing
    where existing.reference_normalisee=v_reference and existing.id<>r.id
  ) then
    raise exception 'Cette reference de transaction existe deja dans l historique des reglements NAXA';
  end if;

  insert into public.naxa_promoteur_payment_reference_claims(
    reglement_id,canal,transaction_reference,source_level,source_type,
    provider_occurred_at,sms_received_at,payload_sha256
  ) values (
    r.id,p_canal,trim(p_reference),p_source_level,p_source_type,
    p_provider_occurred_at,p_sms_received_at,p_payload_sha256
  ) returning id into v_claim_id;

  update public.abonnement_promoteur_reglements
  set verification_level=greatest(verification_level,p_source_level),
      verification_details=verification_details || jsonb_build_object(
        'secondary_reference_added',true,
        'secondary_reference_source',p_source_type,
        'secondary_reference_at',now()
      ),
      updated_at=now()
  where id=r.id;
  return v_claim_id;
end;
$function$


revoke all on function public.naxa_promoteur_payment_add_reference(uuid,text,text,smallint,text,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.naxa_promoteur_payment_add_reference(uuid,text,text,smallint,text,timestamptz,timestamptz,text) to service_role;

CREATE OR REPLACE FUNCTION public.naxa_promoteur_payment_auto_confirm_admin_sms(p_capture_event uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  e public.naxa_admin_payment_capture_events%rowtype;
  d public.naxa_admin_payment_devices%rowtype;
  a public.abonnement_promoteur_reglements%rowtype;
  admin_profile public.profiles%rowtype;
  v_confirmation jsonb;
  v_phone_reglement text;
  v_phone_sms text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service interne NAXA requis';
  end if;

  select * into e
  from public.naxa_admin_payment_capture_events
  where id=p_capture_event
  for update;
  if not found then raise exception 'Capture Admin introuvable'; end if;
  if e.match_status='confirmed' then
    return jsonb_build_object('status','already_confirmed','reglement_id',e.reglement_id);
  end if;
  if e.match_status<>'matched' or e.reglement_id is null then
    raise exception 'Capture Admin non rapprochee';
  end if;

  select * into d from public.naxa_admin_payment_devices
  where id=e.device_id for share;
  if not found or d.is_active is not true
     or d.admin_id<>e.admin_id
     or d.canal<>e.canal
     or d.merchant_reference<>e.merchant_reference then
    raise exception 'Telephone Admin ou destination marchande non valide';
  end if;

  select * into admin_profile from public.profiles
  where id=d.admin_id and role::text='admin' and actif=true;
  if not found then raise exception 'Un compte Administrateur actif est requis'; end if;

  if e.direction<>'merchant_credit'
     or e.success is not true
     or e.amount<=0
     or e.currency<>'FCFA'
     or length(e.reference_normalisee)<5
     or e.sms_received_at > now() + interval '5 minutes'
     or e.sms_received_at < now() - interval '24 hours' then
    raise exception 'SMS de credit Admin incomplet';
  end if;

  select * into a from public.abonnement_promoteur_reglements
  where id=e.reglement_id for update;
  if not found or a.statut<>'en_attente' then
    raise exception 'Reglement absent ou deja traite';
  end if;
  if a.canal<>e.canal or a.montant<>e.amount
     or a.destination_snapshot->>'reference_destination'<>d.merchant_reference
     or a.verification_deadline_at<=now()
     or e.sms_received_at<a.declared_at-interval '5 minutes'
     or e.sms_received_at<a.paye_le-interval '15 minutes'
     or e.sms_received_at>a.paye_le+interval '30 minutes'
     or e.sms_received_at>a.verification_deadline_at then
    raise exception 'Montant, destination ou fenetre de verification differents';
  end if;

  if e.payer_number is null or length(regexp_replace(e.payer_number,'[^0-9]','','g'))<8 then
    raise exception 'Le numero payeur est absent : confirmation manuelle requise';
  end if;
  v_phone_reglement:=right(regexp_replace(coalesce(a.compte_payeur,''),'[^0-9]','','g'),9);
  v_phone_sms:=right(regexp_replace(coalesce(e.payer_number,''),'[^0-9]','','g'),9);
  if length(v_phone_reglement)=9 and length(v_phone_sms)=9 and v_phone_reglement<>v_phone_sms then
    raise exception 'Le payeur du SMS Admin ne correspond pas au compte payeur declare';
  end if;

  if e.provider_occurred_at is not null
     and (e.provider_occurred_at>a.paye_le+interval '30 minutes'
       or e.provider_occurred_at<a.paye_le-interval '15 minutes'
       or e.provider_occurred_at>now()+interval '5 minutes') then
    raise exception 'Horodatage operateur incompatible avec le paiement declare';
  end if;

  if not exists (
    select 1
    from public.naxa_promoteur_payment_sms_evidence payer
    join public.naxa_promoteur_payment_sms_evidence merchant
      on merchant.reglement_id=payer.reglement_id
     and merchant.reference_claim_id=payer.reference_claim_id
     and merchant.reference_normalisee=payer.reference_normalisee
     and merchant.canal=payer.canal
    where payer.reglement_id=a.id
      and payer.reference_normalisee=e.reference_normalisee
      and payer.canal=e.canal
      and payer.source_type='payer_sms'
      and merchant.source_type='merchant_sms'
      and payer.payload_sha256 is not null
      and merchant.payload_sha256=e.payload_sha256
      and payer.payload_sha256<>merchant.payload_sha256
  ) then
    raise exception 'Les SMS debit et credit ne portent pas le meme ID de transaction ou la seconde preuve est absente';
  end if;

  v_confirmation:=public.admin_confirmer_reglement_promoteur(a.id,d.admin_id);

  update public.abonnement_promoteur_reglements
  set verification_status='auto_confirmed_admin_sms',
      verification_level=2,
      verification_details=verification_details || jsonb_build_object(
        'autoConfirmedByAdminSms',true,
        'adminCaptureEventId',e.id,
        'adminDeviceId',d.id,
        'adminId',d.admin_id,
        'merchantSmsReference',e.transaction_reference,
        'merchantSmsReceivedAt',e.sms_received_at,
        'merchantSmsProviderOccurredAt',e.provider_occurred_at,
        'merchantSmsSenderId',e.sender_origin_id,
        'merchantSmsSenderIdUsedOnlyForCollectionFilter',true,
        'dualSmsSameTransactionId',true
      ),
      updated_at=now()
  where id=a.id;

  update public.naxa_admin_payment_capture_events
  set match_status='confirmed'
  where id=e.id;

  update public.naxa_admin_payment_devices
  set last_seen_at=now(),updated_at=now()
  where id=d.id;

  return jsonb_build_object(
    'status','auto_confirmed_admin_sms',
    'reglement_id',a.id,
    'admin_id',d.admin_id,
    'identifiant_paiement',v_confirmation->>'identifiant_paiement',
    'numero_recu',v_confirmation->>'numero_recu'
  );
end;
$function$


revoke all on function public.naxa_promoteur_payment_auto_confirm_admin_sms(uuid) from public,anon,authenticated;
grant execute on function public.naxa_promoteur_payment_auto_confirm_admin_sms(uuid) to service_role;

commit;

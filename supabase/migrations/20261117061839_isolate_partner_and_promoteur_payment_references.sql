begin;

create or replace function public.promoteur_soumettre_reglement(
  p_promoteur uuid,
  p_montant integer,
  p_canal text,
  p_canal_autre text,
  p_compte_payeur text,
  p_reference text,
  p_paye_le timestamptz,
  p_preuve_path text,
  p_verification_details jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_abonnement public.abonnements_promoteurs%rowtype;
  v_convention public.conventions_promoteurs%rowtype;
  v_id uuid;
  v_claim_id uuid;
  v_admin record;
  v_canal_label text;
  v_promoteur_label text;
  v_destination jsonb;
  v_declared_at timestamptz:=clock_timestamp();
  v_details jsonb:=case
    when jsonb_typeof(coalesce(p_verification_details,'{}'::jsonb))='object'
    then coalesce(p_verification_details,'{}'::jsonb) else '{}'::jsonb end;
  v_level smallint;
  v_analysis_status text;
  v_reference_normalisee text;
  v_sms_hash text;
begin
  if p_promoteur is null or not exists(
    select 1 from public.profiles
    where id=p_promoteur and role::text='promoteur' and actif=true
  ) then raise exception 'Compte Promoteur actif introuvable'; end if;
  if p_montant is null or p_montant<=0 then raise exception 'Montant invalide'; end if;
  if p_canal not in ('orange_money','mtn_momo') then
    raise exception 'Seuls Orange Money et MTN Mobile Money sont autorises pour un abonnement Promoteur';
  end if;
  if length(trim(coalesce(p_compte_payeur,'')))<3 or length(trim(p_compte_payeur))>120 then
    raise exception 'Numero du payeur obligatoire';
  end if;
  if nullif(trim(coalesce(p_reference,'')),'') is null or length(trim(p_reference))>160 then
    raise exception 'Reference de transaction obligatoire';
  end if;
  if p_paye_le is null or p_paye_le>v_declared_at+interval '5 minutes'
    or p_paye_le<v_declared_at-interval '24 hours' then
    raise exception 'Date et heure reelles du paiement hors de la fenetre des dernieres 24 heures';
  end if;
  if p_preuve_path is not null and p_preuve_path !~ (
    '^'||p_promoteur::text||'/[0-9a-fA-F-]+\\.(pdf|jpg|jpeg|png|webp)$'
  ) then raise exception 'Chemin de preuve invalide'; end if;

  select * into v_abonnement from public.abonnements_promoteurs
  where promoteur_id=p_promoteur for update;
  if not found then raise exception 'Abonnement Promoteur introuvable'; end if;
  select * into v_convention from public.conventions_promoteurs
  where id=v_abonnement.convention_id and promoteur_id=p_promoteur for update;
  if not found then raise exception 'Convention Promoteur introuvable'; end if;
  if p_montant<>v_abonnement.montant_mensuel or p_montant<>v_convention.montant_mensuel then
    raise exception 'Montant different du tarif mensuel conventionne';
  end if;
  if exists(select 1 from public.abonnement_promoteur_reglements
    where promoteur_id=p_promoteur and statut in ('en_attente','non_confirme')) then
    raise exception 'Un reglement est deja en attente pour ce Promoteur';
  end if;

  v_reference_normalisee:=upper(regexp_replace(trim(p_reference),'[^A-Za-z0-9]','','g'));
  if exists(select 1 from public.naxa_promoteur_payment_reference_claims
      where reference_normalisee=v_reference_normalisee)
    or exists(select 1 from public.partner_subscription_payments
      where reference_normalisee=v_reference_normalisee)
    or exists(select 1 from public.naxa_universe_payment_confirmations
      where reference_normalisee=v_reference_normalisee) then
    raise exception 'Cette reference de transaction a deja ete utilisee dans NAXA';
  end if;

  select jsonb_build_object(
    'canal',d.canal,'beneficiaire',d.beneficiaire,
    'reference_destination',d.reference_destination,'instructions',d.instructions,'updated_at',d.updated_at
  ) into v_destination
  from public.naxa_payment_destinations d
  where d.canal=p_canal and d.actif=true for share;
  if v_destination is null then raise exception 'Destination de paiement non configuree ou inactive'; end if;

  select coalesce(nullif(trim(concat_ws(' ',first_name,last_name)),''),nullif(username,''),p_promoteur::text)
  into v_promoteur_label from public.profiles where id=p_promoteur;

  v_level:=case when (v_details->>'level') in ('1','2','3') then (v_details->>'level')::smallint else 3 end;
  v_analysis_status:=case
    when v_details->>'status' in ('coherent_needs_operator_confirmation','manual_review','invalid')
    then v_details->>'status' else 'manual_review' end;

  if v_level=1 then
    v_sms_hash:=coalesce(v_details->>'smsPayloadSha256','');
    if v_details->>'source'<>'promoter_voluntary_sms_share'
      or v_details->>'sourceType'<>'voluntary_sms_share'
      or v_details->>'direction'<>'payer_debit'
      or v_details->>'success'<>'true'
      or coalesce(v_details->>'amount','') !~ '^[0-9]+$'
      or (v_details->>'amount')::integer<>p_montant
      or upper(regexp_replace(coalesce(v_details->>'extractedReference',''),'[^A-Za-z0-9]','','g'))<>v_reference_normalisee
      or v_sms_hash !~ '^[0-9a-f]{64}$' then
      raise exception 'Preuve SMS de debit invalide ou incoherente avec la reference declaree';
    end if;
  end if;

  insert into public.abonnement_promoteur_reglements(
    promoteur_id,abonnement_id,montant,canal,canal_autre,compte_payeur,reference,
    paye_le,preuve_path,enregistre_par,destination_snapshot,destination_snapshot_at,
    declared_at,verification_deadline_at,verification_level,verification_status,verification_details
  ) values(
    p_promoteur,v_abonnement.id,p_montant,p_canal,null,trim(p_compte_payeur),trim(p_reference),
    p_paye_le,p_preuve_path,p_promoteur,v_destination,v_declared_at,v_declared_at,
    v_declared_at+interval '24 hours',v_level,v_analysis_status,v_details
  ) returning id into v_id;

  insert into public.naxa_promoteur_payment_reference_claims(
    reglement_id,canal,transaction_reference,source_level,source_type,provider_occurred_at,sms_received_at
  ) values(
    v_id,p_canal,trim(p_reference),v_level,
    case when v_level=1 then 'payer_sms' when v_level=2 then 'merchant_sms' else 'promoter_submission' end,
    nullif(v_details->>'providerOccurredAt','')::timestamptz,
    nullif(v_details->>'smsReceivedAt','')::timestamptz
  ) returning id into v_claim_id;

  if v_level=1 then
    insert into public.naxa_promoteur_payment_sms_evidence(
      reglement_id,reference_claim_id,canal,source_level,source_type,
      transaction_reference,provider_occurred_at,sms_received_at,payload_sha256
    ) values(
      v_id,v_claim_id,p_canal,1,'payer_sms',trim(p_reference),
      nullif(v_details->>'providerOccurredAt','')::timestamptz,
      nullif(v_details->>'smsReceivedAt','')::timestamptz,v_sms_hash
    );
  end if;

  v_canal_label:=case p_canal when 'orange_money' then 'Orange Money' else 'MTN Mobile Money' end;
  for v_admin in select id from public.profiles where role::text='admin' and actif=true loop
    insert into public.notifications(user_id,type,titre,corps)
    values(
      v_admin.id,'abonnement_reglement_a_verifier','Paiement Promoteur a verifier',
      left(v_promoteur_label||' a declare '||p_montant::text||' FCFA via '||v_canal_label||
        '. Compte payeur : '||trim(p_compte_payeur)||'. Reference : '||trim(p_reference)||
        '. Paiement declare : '||to_char(p_paye_le at time zone 'Africa/Douala','DD/MM/YYYY HH24:MI')||
        '. Echeance de verification : '||to_char((v_declared_at+interval '24 hours') at time zone 'Africa/Douala','DD/MM/YYYY HH24:MI')||
        '. Analysez les elements et confirmez uniquement apres controle de l''encaissement.',1000)
    );
  end loop;
  insert into public.notifications(user_id,type,titre,corps)
  values(
    p_promoteur,'abonnement_reglement_soumis','Paiement transmis a NAXA',
    'Votre declaration est en cours de verification pendant 24 heures. Ce delai ne confirme pas le paiement et ne renouvelle pas encore votre abonnement.'
  );
  return v_id;
end;
$fn$;

-- Empêche également une même référence de servir à une réservation Client ou à un autre abonnement.
create or replace function public.partner_soumettre_reglement_abonnement(
  p_partner_id uuid,
  p_montant bigint,
  p_canal text,
  p_compte_payeur text,
  p_reference text,
  p_paye_le timestamptz,
  p_preuve_path text default null
) returns uuid
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_uid uuid:=auth.uid();
  v_sub public.partner_subscriptions%rowtype;
  v_dossier public.admin_partner_dossiers%rowtype;
  v_destination jsonb;
  v_id uuid;
  v_status text;
  v_reference text:=upper(regexp_replace(trim(coalesce(p_reference,'')),'[^A-Za-z0-9]','','g'));
  v_now timestamptz:=clock_timestamp();
begin
  if v_uid is null then raise exception 'Connexion requise' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_uid and p.actif is true) then
    raise exception 'Identité NAXA inactive' using errcode='42501';
  end if;
  select d.* into v_dossier
  from public.admin_partner_dossiers d
  join public.partner_members pm on pm.partner_id=d.partner_id
    and pm.user_id=v_uid and pm.member_role='owner'
  where d.partner_id=p_partner_id and d.universe_slug in ('parapharmacie','examens','prestations')
    and d.dossier_status='validated';
  if not found then raise exception 'Structure validée ou titulaire introuvable' using errcode='42501'; end if;

  select * into v_sub from public.partner_subscriptions
  where partner_id=p_partner_id for update;
  if not found then raise exception 'Contrat d’abonnement introuvable'; end if;
  if v_sub.status='cancelled' then raise exception 'Contrat résilié : déclaration impossible'; end if;

  if p_montant is null or p_montant<=0 or p_montant<>v_dossier.monthly_fee_fcfa
    or p_canal not in ('orange_money','mtn_momo')
    or length(trim(coalesce(p_compte_payeur,''))) not between 3 and 120
    or length(trim(coalesce(p_reference,''))) not between 5 and 160
    or v_reference='' then
    raise exception 'Montant, canal, compte payeur ou référence invalide';
  end if;
  if p_paye_le is null or p_paye_le>v_now+interval '5 minutes'
    or p_paye_le<v_now-interval '24 hours' then
    raise exception 'Date de paiement hors de la fenêtre des dernières 24 heures';
  end if;
  if p_preuve_path is not null and p_preuve_path !~ (
    '^'||p_partner_id::text||'/[0-9a-fA-F-]+\.(pdf|jpg|jpeg|png|webp)$'
  ) then raise exception 'Chemin de preuve invalide'; end if;

  if exists(select 1 from public.partner_subscription_payments where reference_normalisee=v_reference)
    or exists(select 1 from public.naxa_promoteur_payment_reference_claims where reference_normalisee=v_reference)
    or exists(select 1 from public.naxa_universe_payment_confirmations where reference_normalisee=v_reference) then
    raise exception 'Cette référence de transaction est déjà utilisée dans NAXA';
  end if;
  if exists(select 1 from public.partner_subscription_payments
    where partner_id=p_partner_id and status='pending') then
    raise exception 'Un règlement est déjà en attente pour cette structure';
  end if;

  select jsonb_build_object(
    'canal',d.canal,'beneficiaire',d.beneficiaire,
    'reference_destination',d.reference_destination,'instructions',d.instructions,'updated_at',d.updated_at
  ) into v_destination
  from public.naxa_payment_destinations d
  where d.canal=p_canal and d.actif=true;
  if v_destination is null then raise exception 'Destination de paiement non configurée ou inactive'; end if;

  insert into public.partner_subscription_payments(
    partner_id,amount_fcfa,canal,payer_account,transaction_reference,reference_normalisee,
    paid_at,proof_path,destination_snapshot,submitted_by
  ) values(
    p_partner_id,p_montant,p_canal,trim(p_compte_payeur),trim(p_reference),v_reference,
    p_paye_le,p_preuve_path,v_destination,v_uid
  ) returning id into v_id;

  perform private.naxa_partner_subscription_try_match(p_partner_id,v_reference);
  select status into v_status from public.partner_subscription_payments where id=v_id;
  if v_status='pending' then
    insert into public.notifications(user_id,type,titre,corps,related_entity_id)
    values(v_uid,'partner_subscription_payment_submitted','Règlement partenaire transmis',
      'Votre déclaration a été transmise à NAXA. Elle reste en attente de vérification ; aucun cycle n’est renouvelé avant confirmation.',v_id);

    insert into public.notifications(user_id,type,titre,corps,related_entity_id)
    select p.id,'partner_subscription_payment_admin_review','Règlement partenaire à vérifier',
      'Un règlement d’abonnement partenaire est en attente de vérification dans NAXA.',v_id
    from public.profiles p where p.role::text='admin' and p.actif=true;
  end if;
  return v_id;
end;
$fn$;

commit;

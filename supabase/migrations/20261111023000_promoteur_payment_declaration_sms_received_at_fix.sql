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
set search_path = ''
as $function$
declare
  v_abonnement public.abonnements_promoteurs%rowtype;
  v_convention public.conventions_promoteurs%rowtype;
  v_id uuid;
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

  if exists (
    select 1 from public.naxa_promoteur_payment_reference_claims
    where reference_normalisee=upper(regexp_replace(trim(p_reference),'[^A-Za-z0-9]','','g'))
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
  );

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
$function$;

revoke all on function public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text,jsonb)
  to service_role;

create or replace function public.naxa_promoteur_payment_auto_confirm_admin_sms(
  p_capture_event uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
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

  if e.sender_origin_id <> (case e.canal when 'orange_money' then 'OrangeMoney' else 'MobileMoney' end)
     or e.sender_origin_id ~ '[0-9]'
     or e.direction<>'merchant_credit'
     or e.success is not true
     or e.amount<=0
     or e.currency<>'FCFA'
     or length(e.reference_normalisee)<5
     or e.sms_received_at > now() + interval '5 minutes'
     or e.sms_received_at < now() - interval '24 hours' then
    raise exception 'SMS de credit Admin incomplet ou non fiable';
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
    select 1 from public.naxa_promoteur_payment_reference_claims c
    where c.reglement_id=a.id
      and c.reference_normalisee=e.reference_normalisee
      and c.canal=e.canal
      and c.source_level in (1,2)
      and c.source_type in ('payer_sms','merchant_sms')
  ) then
    raise exception 'La reference du SMS marchand n est pas rattachee au dossier';
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
        'merchantSmsSenderId',e.sender_origin_id
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
$function$;

revoke all on function public.naxa_promoteur_payment_auto_confirm_admin_sms(uuid) from public,anon,authenticated;
grant execute on function public.naxa_promoteur_payment_auto_confirm_admin_sms(uuid) to service_role;

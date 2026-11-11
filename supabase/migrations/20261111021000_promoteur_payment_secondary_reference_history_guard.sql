create or replace function public.naxa_promoteur_payment_add_reference(
  p_reglement uuid,
  p_canal text,
  p_reference text,
  p_source_level smallint,
  p_source_type text,
  p_provider_occurred_at timestamptz default null,
  p_sms_received_at timestamptz default null,
  p_payload_sha256 text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  r public.abonnement_promoteur_reglements%rowtype;
  v_id uuid;
  v_reference text := upper(regexp_replace(trim(coalesce(p_reference,'')), '[^A-Za-z0-9]', '', 'g'));
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
  select id into v_id from public.naxa_promoteur_payment_reference_claims
  where reference_normalisee=v_reference and reglement_id=r.id;
  if v_id is not null then return v_id; end if;

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
  ) returning id into v_id;

  update public.abonnement_promoteur_reglements
  set verification_level=greatest(verification_level,p_source_level),
      verification_details=verification_details || jsonb_build_object(
        'secondary_reference_added',true,
        'secondary_reference_source',p_source_type,
        'secondary_reference_at',now()
      ),
      updated_at=now()
  where id=r.id;
  return v_id;
end;
$function$;

revoke all on function public.naxa_promoteur_payment_add_reference(uuid,text,text,smallint,text,timestamptz,timestamptz,text)
  from public,anon,authenticated;
grant execute on function public.naxa_promoteur_payment_add_reference(uuid,text,text,smallint,text,timestamptz,timestamptz,text)
  to service_role;

begin;

alter table public.partner_subscription_payments
  add column if not exists payer_candidate_id uuid
    references public.naxa_partner_payment_notification_candidates(id) on delete restrict,
  add column if not exists merchant_capture_event_id uuid
    references public.naxa_admin_payment_capture_events(id) on delete restrict,
  add column if not exists confirmation_source text;

create unique index if not exists partner_subscription_payment_payer_candidate_uq
  on public.partner_subscription_payments(payer_candidate_id) where payer_candidate_id is not null;
create unique index if not exists partner_subscription_payment_merchant_event_uq
  on public.partner_subscription_payments(merchant_capture_event_id) where merchant_capture_event_id is not null;

alter table public.partner_subscription_payments
  add constraint partner_subscription_payment_confirmation_source_check
  check (
    (status<>'confirmed' and confirmation_source is null)
    or (status='confirmed' and confirmation_source in ('manual_admin','paired_sms'))
  );

create or replace function private.naxa_set_partner_subscription_confirmation_source()
returns trigger
language plpgsql
security definer
set search_path=''
as $fn$
begin
  if new.status='confirmed' and new.confirmation_source is null then
    new.confirmation_source:='manual_admin';
  end if;
  return new;
end;
$fn$;

revoke all on function private.naxa_set_partner_subscription_confirmation_source() from public,anon,authenticated,service_role;
drop trigger if exists trg_partner_subscription_confirmation_source on public.partner_subscription_payments;
create trigger trg_partner_subscription_confirmation_source
before insert or update of status on public.partner_subscription_payments
for each row execute function private.naxa_set_partner_subscription_confirmation_source();

create or replace function private.naxa_confirm_partner_subscription_payment(
  p_reglement uuid,
  p_admin uuid,
  p_source text,
  p_candidate uuid default null,
  p_event uuid default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  r public.partner_subscription_payments%rowtype;
  s public.partner_subscriptions%rowtype;
  d public.admin_partner_dossiers%rowtype;
  v_today date:=(now() at time zone 'Africa/Douala')::date;
  v_start date;
  v_end date;
  v_receipt text;
begin
  if p_source not in ('manual_admin','paired_sms')
    or not exists(select 1 from public.profiles p where p.id=p_admin and p.role::text='admin' and p.actif=true) then
    raise exception 'Décision administrateur active requise' using errcode='42501';
  end if;

  select * into r from public.partner_subscription_payments where id=p_reglement for update;
  if not found then raise exception 'Règlement introuvable'; end if;
  if r.status='confirmed' then
    return jsonb_build_object('id',r.id,'receipt_number',r.receipt_number,
      'period_start',r.period_start,'period_end',r.period_end,
      'confirmation_source',r.confirmation_source,'already_confirmed',true);
  end if;
  if r.status<>'pending' then raise exception 'Ce règlement n’est plus en attente'; end if;

  select * into d from public.admin_partner_dossiers where partner_id=r.partner_id for update;
  if not found or d.dossier_status<>'validated' then
    raise exception 'Le dossier de la structure doit être validé avant confirmation';
  end if;
  select * into s from public.partner_subscriptions where partner_id=r.partner_id for update;
  if not found or r.amount_fcfa<>d.monthly_fee_fcfa or r.amount_fcfa<>s.monthly_fee_fcfa then
    raise exception 'Le montant ne correspond plus au tarif mensuel de la structure';
  end if;
  if s.status='cancelled' then raise exception 'Contrat résilié : décision administrative distincte requise'; end if;

  if p_source='paired_sms' then
    if p_candidate is null or p_event is null then
      raise exception 'Les deux preuves SMS sont obligatoires pour une confirmation automatique';
    end if;
    if not exists(
      select 1
      from public.naxa_partner_payment_notification_candidates c
      join public.naxa_partner_payment_devices pd
        on pd.id=c.device_id and pd.partner_id=c.partner_id and pd.user_id=c.user_id and pd.is_active=true
      join public.partner_members pm
        on pm.partner_id=c.partner_id and pm.user_id=c.user_id and pm.member_role in ('owner','manager')
      join public.profiles pp on pp.id=c.user_id and pp.actif=true
      where c.id=p_candidate and c.partner_id=r.partner_id
        and c.source_type='voluntary_sms_share'
        and c.transaction_direction='payer_debit'
        and c.status='manual_review'
        and c.canal=r.canal and c.amount=r.amount_fcfa
        and upper(regexp_replace(coalesce(c.transaction_reference,''),'[^A-Za-z0-9]','','g'))=r.reference_normalisee
        and c.payer_number is not null
        and right(regexp_replace(c.payer_number,'[^0-9]','','g'),9)
          =right(regexp_replace(r.payer_account,'[^0-9]','','g'),9)
        and c.provider_occurred_at between r.paid_at-interval '15 minutes' and r.paid_at+interval '30 minutes'
        and c.received_at between r.submitted_at-interval '5 minutes' and r.submitted_at+interval '24 hours'
    ) then raise exception 'Preuve de débit Partenaire absente, incomplète ou incohérente'; end if;

    if not exists(
      select 1
      from public.naxa_admin_payment_capture_events e
      join public.naxa_admin_payment_devices ad
        on ad.id=e.device_id and ad.admin_id=e.admin_id and ad.is_active=true
        and ad.canal=e.canal and ad.merchant_reference=e.merchant_reference
      join public.profiles ap on ap.id=e.admin_id and ap.role::text='admin' and ap.actif=true
      join public.naxa_partner_payment_notification_candidates c on c.id=p_candidate
      where e.id=p_event and e.admin_id=p_admin and e.reglement_id is null
        and e.direction='merchant_credit' and e.success=true
        and e.match_status='manual_review'
        and e.canal=r.canal and e.amount=r.amount_fcfa and e.currency='FCFA'
        and upper(regexp_replace(coalesce(e.transaction_reference,''),'[^A-Za-z0-9]','','g'))=r.reference_normalisee
        and upper(regexp_replace(coalesce(e.merchant_reference,''),'[^A-Za-z0-9]','','g'))
          =upper(regexp_replace(coalesce(r.destination_snapshot->>'reference_destination',''),'[^A-Za-z0-9]','','g'))
        and e.sender_origin_id=case when r.canal='orange_money' then 'OrangeMoney' else 'MobileMoney' end
        and e.payer_number is not null
        and right(regexp_replace(e.payer_number,'[^0-9]','','g'),9)
          =right(regexp_replace(c.payer_number,'[^0-9]','','g'),9)
        and e.payload_sha256<>c.payload_sha256
        and e.provider_occurred_at between r.paid_at-interval '15 minutes' and r.paid_at+interval '30 minutes'
        and e.sms_received_at between r.submitted_at-interval '5 minutes' and r.submitted_at+interval '24 hours'
    ) then raise exception 'Preuve de crédit Admin absente, non authentifiée ou incohérente'; end if;
  elsif p_candidate is not null or p_event is not null then
    raise exception 'Une confirmation manuelle ne peut pas s’approprier des preuves SMS';
  end if;

  if s.first_confirmed_payment_at is null then
    v_start:=v_today;
  elsif s.status='active' and s.due_date>=v_today then
    v_start:=s.due_date+1;
  else
    v_start:=v_today;
  end if;
  v_end:=(v_start+interval '1 month'-interval '1 day')::date;
  v_receipt:='NAXA-PART-'||to_char(v_today,'YYYYMMDD')||'-'||upper(substr(replace(r.id::text,'-',''),1,10));

  update public.partner_subscription_payments
  set status='confirmed',confirmed_by=p_admin,confirmed_at=now(),
      period_start=v_start,period_end=v_end,receipt_number=v_receipt,
      confirmation_source=p_source,payer_candidate_id=p_candidate,
      merchant_capture_event_id=p_event,updated_at=now()
  where id=r.id;

  update public.partner_subscriptions
  set status='active',period_start=v_start,due_date=v_end,
      first_confirmed_payment_at=coalesce(first_confirmed_payment_at,now()),
      last_confirmed_payment_at=now(),legacy_access_until=null,
      reminder_5d_sent_at=null,updated_at=now()
  where partner_id=r.partner_id;

  update public.partners set status='active',verified_at=coalesce(verified_at,now()),
    verified_by=p_admin,updated_at=now()
  where id=r.partner_id and status='pending' and d.dossier_status='validated'
    and exists(select 1 from public.profiles p where p.id=d.promoteur_id and p.actif=true);
  update public.partner_universes set enabled=true
  where partner_id=r.partner_id and exists(
    select 1 from public.partners pa where pa.id=r.partner_id and pa.status='active'
  );

  if p_source='paired_sms' then
    update public.naxa_admin_payment_capture_events
    set match_status='confirmed' where id=p_event and match_status='manual_review';
  end if;

  insert into public.notifications(user_id,type,titre,corps,related_entity_id)
  values(d.promoteur_id,'partner_subscription_payment_confirmed',
    'Abonnement partenaire confirmé',
    'Votre règlement a été confirmé par NAXA. Votre cycle est actif jusqu’au '||
      to_char(v_end,'DD/MM/YYYY')||'. Reçu : '||v_receipt||'.',r.id);

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(p_admin,'partner_subscription.payment_confirmed','partner_subscription_payment',r.id::text,
    jsonb_build_object('partner_id',r.partner_id,'universe_slug',d.universe_slug,
      'amount_fcfa',r.amount_fcfa,'period_start',v_start,'period_end',v_end,
      'confirmation_source',p_source,'payer_candidate_id',p_candidate,
      'merchant_capture_event_id',p_event,'identity_actif_mutated',false));

  return jsonb_build_object('id',r.id,'receipt_number',v_receipt,
    'period_start',v_start,'period_end',v_end,'confirmation_source',p_source,
    'already_confirmed',false);
end;
$fn$;

revoke all on function private.naxa_confirm_partner_subscription_payment(uuid,uuid,text,uuid,uuid)
  from public,anon,authenticated,service_role;

create or replace function public.admin_confirmer_reglement_partenaire(
  p_reglement uuid,
  p_admin uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
begin
  if p_admin is distinct from auth.uid() or not public.is_admin()
    or not exists(select 1 from public.profiles p where p.id=p_admin and p.actif=true) then
    raise exception 'Accès administrateur actif requis' using errcode='42501';
  end if;
  return private.naxa_confirm_partner_subscription_payment(
    p_reglement,p_admin,'manual_admin',null,null
  );
end;
$fn$;

create or replace function private.naxa_partner_subscription_try_match(
  p_partner_id uuid,
  p_transaction_reference text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  r public.partner_subscription_payments%rowtype;
  v_ref text:=upper(regexp_replace(trim(coalesce(p_transaction_reference,'')),'[^A-Za-z0-9]','','g'));
  v_payment_count integer;
  v_candidate_count integer;
  v_event_count integer;
  v_candidate uuid;
  v_event uuid;
  v_admin uuid;
begin
  if p_partner_id is null or length(v_ref)<5 or length(v_ref)>160 then
    return jsonb_build_object('status','invalid_match_key');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_partner_id::text||':'||v_ref,0));

  select count(*) into v_payment_count
  from public.partner_subscription_payments p
  where p.partner_id=p_partner_id and p.status='pending'
    and p.reference_normalisee=v_ref;
  if v_payment_count=0 then return jsonb_build_object('status','no_pending_subscription_payment'); end if;
  if v_payment_count>1 then return jsonb_build_object('status','ambiguous_subscription_payment'); end if;

  select * into r from public.partner_subscription_payments p
  where p.partner_id=p_partner_id and p.status='pending'
    and p.reference_normalisee=v_ref for update;
  if not found then return jsonb_build_object('status','payment_already_processed'); end if;

  select count(*) into v_candidate_count
  from public.naxa_partner_payment_notification_candidates c
  join public.naxa_partner_payment_devices pd
    on pd.id=c.device_id and pd.partner_id=c.partner_id and pd.user_id=c.user_id and pd.is_active=true
  join public.partner_members pm
    on pm.partner_id=c.partner_id and pm.user_id=c.user_id and pm.member_role in ('owner','manager')
  join public.profiles pp on pp.id=c.user_id and pp.actif=true
  where c.partner_id=p_partner_id and c.source_type='voluntary_sms_share'
    and c.transaction_direction='payer_debit' and c.status='manual_review'
    and c.canal=r.canal and c.amount=r.amount_fcfa
    and upper(regexp_replace(coalesce(c.transaction_reference,''),'[^A-Za-z0-9]','','g'))=v_ref
    and c.payer_number is not null
    and right(regexp_replace(c.payer_number,'[^0-9]','','g'),9)
      =right(regexp_replace(r.payer_account,'[^0-9]','','g'),9)
    and c.provider_occurred_at between r.paid_at-interval '15 minutes' and r.paid_at+interval '30 minutes'
    and c.received_at between r.submitted_at-interval '5 minutes' and r.submitted_at+interval '24 hours';
  if v_candidate_count=0 then return jsonb_build_object('status','waiting_for_payer_sms'); end if;
  if v_candidate_count>1 then return jsonb_build_object('status','ambiguous_payer_sms'); end if;

  select c.id into v_candidate
  from public.naxa_partner_payment_notification_candidates c
  join public.naxa_partner_payment_devices pd
    on pd.id=c.device_id and pd.partner_id=c.partner_id and pd.user_id=c.user_id and pd.is_active=true
  join public.partner_members pm
    on pm.partner_id=c.partner_id and pm.user_id=c.user_id and pm.member_role in ('owner','manager')
  join public.profiles pp on pp.id=c.user_id and pp.actif=true
  where c.partner_id=p_partner_id and c.source_type='voluntary_sms_share'
    and c.transaction_direction='payer_debit' and c.status='manual_review'
    and c.canal=r.canal and c.amount=r.amount_fcfa
    and upper(regexp_replace(coalesce(c.transaction_reference,''),'[^A-Za-z0-9]','','g'))=v_ref
    and right(regexp_replace(c.payer_number,'[^0-9]','','g'),9)
      =right(regexp_replace(r.payer_account,'[^0-9]','','g'),9)
    and c.provider_occurred_at between r.paid_at-interval '15 minutes' and r.paid_at+interval '30 minutes'
    and c.received_at between r.submitted_at-interval '5 minutes' and r.submitted_at+interval '24 hours'
  limit 1;

  select count(*) into v_event_count
  from public.naxa_admin_payment_capture_events e
  join public.naxa_admin_payment_devices ad
    on ad.id=e.device_id and ad.admin_id=e.admin_id and ad.is_active=true
    and ad.canal=e.canal and ad.merchant_reference=e.merchant_reference
  join public.profiles ap on ap.id=e.admin_id and ap.role::text='admin' and ap.actif=true
  join public.naxa_partner_payment_notification_candidates c on c.id=v_candidate
  where e.reglement_id is null and e.direction='merchant_credit' and e.success=true
    and e.match_status='manual_review'
    and e.canal=r.canal and e.amount=r.amount_fcfa and e.currency='FCFA'
    and upper(regexp_replace(coalesce(e.transaction_reference,''),'[^A-Za-z0-9]','','g'))=v_ref
    and upper(regexp_replace(coalesce(e.merchant_reference,''),'[^A-Za-z0-9]','','g'))
      =upper(regexp_replace(coalesce(r.destination_snapshot->>'reference_destination',''),'[^A-Za-z0-9]','','g'))
    and e.sender_origin_id=case when r.canal='orange_money' then 'OrangeMoney' else 'MobileMoney' end
    and e.payer_number is not null
    and right(regexp_replace(e.payer_number,'[^0-9]','','g'),9)
      =right(regexp_replace(c.payer_number,'[^0-9]','','g'),9)
    and e.payload_sha256<>c.payload_sha256
    and e.provider_occurred_at between r.paid_at-interval '15 minutes' and r.paid_at+interval '30 minutes'
    and e.sms_received_at between r.submitted_at-interval '5 minutes' and r.submitted_at+interval '24 hours';
  if v_event_count=0 then return jsonb_build_object('status','waiting_for_admin_credit_sms'); end if;
  if v_event_count>1 then return jsonb_build_object('status','ambiguous_admin_credit_sms'); end if;

  select e.id,e.admin_id into v_event,v_admin
  from public.naxa_admin_payment_capture_events e
  join public.naxa_admin_payment_devices ad
    on ad.id=e.device_id and ad.admin_id=e.admin_id and ad.is_active=true
    and ad.canal=e.canal and ad.merchant_reference=e.merchant_reference
  join public.profiles ap on ap.id=e.admin_id and ap.role::text='admin' and ap.actif=true
  join public.naxa_partner_payment_notification_candidates c on c.id=v_candidate
  where e.reglement_id is null and e.direction='merchant_credit' and e.success=true
    and e.match_status='manual_review'
    and e.canal=r.canal and e.amount=r.amount_fcfa and e.currency='FCFA'
    and upper(regexp_replace(coalesce(e.transaction_reference,''),'[^A-Za-z0-9]','','g'))=v_ref
    and upper(regexp_replace(coalesce(e.merchant_reference,''),'[^A-Za-z0-9]','','g'))
      =upper(regexp_replace(coalesce(r.destination_snapshot->>'reference_destination',''),'[^A-Za-z0-9]','','g'))
    and e.sender_origin_id=case when r.canal='orange_money' then 'OrangeMoney' else 'MobileMoney' end
    and right(regexp_replace(e.payer_number,'[^0-9]','','g'),9)
      =right(regexp_replace(c.payer_number,'[^0-9]','','g'),9)
    and e.payload_sha256<>c.payload_sha256
    and e.provider_occurred_at between r.paid_at-interval '15 minutes' and r.paid_at+interval '30 minutes'
    and e.sms_received_at between r.submitted_at-interval '5 minutes' and r.submitted_at+interval '24 hours'
  limit 1;

  return private.naxa_confirm_partner_subscription_payment(
    r.id,v_admin,'paired_sms',v_candidate,v_event
  );
end;
$fn$;

revoke all on function private.naxa_partner_subscription_try_match(uuid,text)
  from public,anon,authenticated,service_role;

create or replace function private.naxa_partner_subscription_evidence_after_insert()
returns trigger
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_partner uuid;
  v_reference text;
  item record;
begin
  if tg_table_name='naxa_partner_payment_notification_candidates' then
    perform private.naxa_partner_subscription_try_match(
      new.partner_id,new.transaction_reference
    );
  elsif tg_table_name='naxa_admin_payment_capture_events' then
    if new.reglement_id is null and new.direction='merchant_credit'
      and new.success=true and new.match_status='manual_review' then
      v_reference:=upper(regexp_replace(coalesce(new.transaction_reference,''),'[^A-Za-z0-9]','','g'));
      for item in
        select distinct p.partner_id,p.reference_normalisee
        from public.partner_subscription_payments p
        where p.status='pending' and p.canal=new.canal and p.amount_fcfa=new.amount
          and p.reference_normalisee=v_reference
          and upper(regexp_replace(coalesce(p.destination_snapshot->>'reference_destination',''),'[^A-Za-z0-9]','','g'))
            =upper(regexp_replace(coalesce(new.merchant_reference,''),'[^A-Za-z0-9]','','g'))
      loop
        perform private.naxa_partner_subscription_try_match(item.partner_id,item.reference_normalisee);
      end loop;
    end if;
  end if;
  return new;
end;
$fn$;

revoke all on function private.naxa_partner_subscription_evidence_after_insert() from public,anon,authenticated,service_role;
drop trigger if exists trg_partner_subscription_payer_candidate_match on public.naxa_partner_payment_notification_candidates;
create trigger trg_partner_subscription_payer_candidate_match
after insert on public.naxa_partner_payment_notification_candidates
for each row execute function private.naxa_partner_subscription_evidence_after_insert();
drop trigger if exists trg_partner_subscription_admin_credit_match on public.naxa_admin_payment_capture_events;
create trigger trg_partner_subscription_admin_credit_match
after insert on public.naxa_admin_payment_capture_events
for each row execute function private.naxa_partner_subscription_evidence_after_insert();

-- Une preuve déjà arrivée avant la déclaration peut être rapprochée immédiatement.
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

  if exists(select 1 from public.partner_subscription_payments
    where reference_normalisee=v_reference) then
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
  ) values (
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

begin;

-- Chaque structure Parapharmacie / Examens / Prestations porte son propre contrat.
-- Les cycles historiques encore valides sont conservés comme accès transitoire,
-- sans les convertir en paiement indépendant ni créer une nouvelle période payée.

create table public.partner_subscriptions (
  partner_id uuid primary key references public.admin_partner_dossiers(partner_id) on delete cascade,
  universe_slug text not null check (universe_slug in ('parapharmacie','examens','prestations')),
  monthly_fee_fcfa bigint not null check (monthly_fee_fcfa > 0),
  status text not null default 'pending_payment'
    check (status in ('pending_payment','active','expired','cancelled')),
  period_start date,
  due_date date,
  first_confirmed_payment_at timestamptz,
  last_confirmed_payment_at timestamptz,
  legacy_access_until date,
  reminder_5d_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_subscriptions_period_pair_check
    check ((period_start is null) = (due_date is null)),
  constraint partner_subscriptions_period_order_check
    check (period_start is null or period_start <= due_date)
);

create table public.partner_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_subscriptions(partner_id) on delete cascade,
  amount_fcfa bigint not null check (amount_fcfa > 0),
  canal text not null check (canal in ('orange_money','mtn_momo')),
  payer_account text not null check (length(trim(payer_account)) between 3 and 120),
  transaction_reference text not null check (length(trim(transaction_reference)) between 5 and 160),
  reference_normalisee text not null,
  paid_at timestamptz not null,
  proof_path text,
  destination_snapshot jsonb not null,
  destination_snapshot_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','confirmed','refused')),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  confirmed_by uuid references auth.users(id) on delete restrict,
  confirmed_at timestamptz,
  refused_by uuid references auth.users(id) on delete restrict,
  refused_at timestamptz,
  refusal_reason text,
  period_start date,
  period_end date,
  receipt_number text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_subscription_payment_decision_check check (
    (status='pending' and confirmed_at is null and refused_at is null)
    or (status='confirmed' and confirmed_at is not null and confirmed_by is not null and refused_at is null)
    or (status='refused' and refused_at is not null and refused_by is not null and confirmed_at is null)
  )
);

create unique index partner_subscription_payment_reference_uq
  on public.partner_subscription_payments(reference_normalisee);
create unique index partner_subscription_one_pending_uq
  on public.partner_subscription_payments(partner_id) where status='pending';
create index partner_subscription_due_idx
  on public.partner_subscriptions(due_date) where status='active';

alter table public.partner_subscriptions enable row level security;
alter table public.partner_subscription_payments enable row level security;
revoke all on public.partner_subscriptions, public.partner_subscription_payments from public, anon;
grant select on public.partner_subscriptions, public.partner_subscription_payments to authenticated;

create policy partner_subscriptions_member_read
on public.partner_subscriptions for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.partner_members pm
    join public.profiles p on p.id=pm.user_id and p.actif is true
    where pm.partner_id=partner_subscriptions.partner_id
      and pm.user_id=(select auth.uid())
  )
);

create policy partner_subscription_payments_member_read
on public.partner_subscription_payments for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.partner_members pm
    join public.profiles p on p.id=pm.user_id and p.actif is true
    where pm.partner_id=partner_subscription_payments.partner_id
      and pm.user_id=(select auth.uid())
      and pm.member_role in ('owner','manager')
  )
);

-- Préserve les périodes héritées encore valides à la date de migration.
-- Elles ne sont pas converties en paiement partenaire et ne sont pas renouvelables.
insert into public.partner_subscriptions(
  partner_id, universe_slug, monthly_fee_fcfa, status, legacy_access_until
)
select
  d.partner_id, d.universe_slug, d.monthly_fee_fcfa,
  'pending_payment',
  case
    when pa.status='active' and pu.enabled and ap.statut='actif' and ap.echeance>=current_date
      then ap.echeance
    else null
  end
from public.admin_partner_dossiers d
join public.partners pa on pa.id=d.partner_id
join public.partner_universes pu on pu.partner_id=d.partner_id and pu.universe_slug=d.universe_slug
left join public.abonnements_promoteurs ap on ap.promoteur_id=d.promoteur_id
where d.universe_slug in ('parapharmacie','examens','prestations')
on conflict (partner_id) do nothing;

create or replace function public.naxa_sync_partner_subscription_dossier()
returns trigger
language plpgsql
security definer
set search_path=''
as $fn$
begin
  if new.universe_slug in ('parapharmacie','examens','prestations') then
    insert into public.partner_subscriptions(partner_id,universe_slug,monthly_fee_fcfa)
    values(new.partner_id,new.universe_slug,new.monthly_fee_fcfa)
    on conflict(partner_id) do update
      set universe_slug=excluded.universe_slug,
          monthly_fee_fcfa=excluded.monthly_fee_fcfa,
          updated_at=now();
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_partner_subscription_dossier_sync on public.admin_partner_dossiers;
create trigger trg_partner_subscription_dossier_sync
after insert or update of universe_slug,monthly_fee_fcfa on public.admin_partner_dossiers
for each row execute function public.naxa_sync_partner_subscription_dossier();

create or replace function private.naxa_partner_has_confirmed_payment(p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $fn$
  select exists (
    select 1
    from public.admin_partner_dossiers d
    join public.partners pa on pa.id=d.partner_id and pa.status='active'
    join public.partner_universes pu on pu.partner_id=pa.id
      and pu.universe_slug=d.universe_slug and pu.enabled=true
    join public.profiles owner_profile on owner_profile.id=d.promoteur_id and owner_profile.actif=true
    join public.partner_subscriptions s on s.partner_id=d.partner_id
    where d.partner_id=p_partner_id
      and d.dossier_status='validated'
      and (
        (s.status='active' and s.first_confirmed_payment_at is not null
          and s.period_start<=current_date and s.due_date>=current_date)
        or (s.first_confirmed_payment_at is null
          and s.legacy_access_until is not null
          and s.legacy_access_until>=current_date)
      )
  );
$fn$;

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

  insert into public.notifications(user_id,type,titre,corps,related_entity_id)
  select p.id,'partner_subscription_payment_submitted','Règlement partenaire transmis',
    'Votre déclaration de paiement a été transmise à NAXA. Elle reste en attente de vérification et ne renouvelle pas encore votre abonnement.',
    v_id
  from public.profiles p where p.id=v_uid;

  insert into public.notifications(user_id,type,titre,corps,related_entity_id)
  select p.id,'partner_subscription_payment_admin_review','Règlement partenaire à vérifier',
    'Un règlement d’abonnement partenaire est en attente de vérification dans NAXA.',
    v_id
  from public.profiles p where p.role::text='admin' and p.actif=true;

  return v_id;
end;
$fn$;

create or replace function public.admin_confirmer_reglement_partenaire(
  p_reglement uuid,
  p_admin uuid
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
  if p_admin is distinct from auth.uid() or not public.is_admin()
    or not exists(select 1 from public.profiles p where p.id=p_admin and p.actif=true) then
    raise exception 'Accès administrateur actif requis' using errcode='42501';
  end if;

  select * into r from public.partner_subscription_payments where id=p_reglement for update;
  if not found then raise exception 'Règlement introuvable'; end if;
  if r.status='confirmed' then
    return jsonb_build_object('id',r.id,'receipt_number',r.receipt_number,
      'period_start',r.period_start,'period_end',r.period_end,'already_confirmed',true);
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
      period_start=v_start,period_end=v_end,receipt_number=v_receipt,updated_at=now()
  where id=r.id;

  update public.partner_subscriptions
  set status='active',period_start=v_start,due_date=v_end,
      first_confirmed_payment_at=coalesce(first_confirmed_payment_at,now()),
      last_confirmed_payment_at=now(),legacy_access_until=null,
      reminder_5d_sent_at=null,updated_at=now()
  where partner_id=r.partner_id;

  -- La confirmation d’un paiement ne réactive jamais l’identité globale.
  update public.partners set status='active',verified_at=coalesce(verified_at,now()),
    verified_by=p_admin,updated_at=now()
  where id=r.partner_id and status='pending' and d.dossier_status='validated'
    and exists(select 1 from public.profiles p where p.id=d.promoteur_id and p.actif=true);
  update public.partner_universes set enabled=true
  where partner_id=r.partner_id and exists(
    select 1 from public.partners pa where pa.id=r.partner_id and pa.status='active'
  );

  insert into public.notifications(user_id,type,titre,corps,related_entity_id)
  values(d.promoteur_id,'partner_subscription_payment_confirmed',
    'Abonnement partenaire confirmé',
    'Votre règlement a été confirmé par NAXA. Votre cycle est actif jusqu’au '||
      to_char(v_end,'DD/MM/YYYY')||'. Reçu : '||v_receipt||'.',r.id);

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(p_admin,'partner_subscription.payment_confirmed','partner_subscription_payment',r.id::text,
    jsonb_build_object('partner_id',r.partner_id,'universe_slug',d.universe_slug,
      'amount_fcfa',r.amount_fcfa,'period_start',v_start,'period_end',v_end,
      'identity_actif_mutated',false));

  return jsonb_build_object('id',r.id,'receipt_number',v_receipt,
    'period_start',v_start,'period_end',v_end,'already_confirmed',false);
end;
$fn$;

create or replace function public.admin_refuser_reglement_partenaire(
  p_reglement uuid,
  p_admin uuid,
  p_motif text
) returns boolean
language plpgsql
security definer
set search_path=''
as $fn$
declare
  r public.partner_subscription_payments%rowtype;
  d public.admin_partner_dossiers%rowtype;
  v_reason text:=trim(coalesce(p_motif,''));
begin
  if p_admin is distinct from auth.uid() or not public.is_admin()
    or not exists(select 1 from public.profiles p where p.id=p_admin and p.actif=true) then
    raise exception 'Accès administrateur actif requis' using errcode='42501';
  end if;
  if length(v_reason) not between 5 and 500 then raise exception 'Motif de refus requis'; end if;
  select * into r from public.partner_subscription_payments where id=p_reglement for update;
  if not found or r.status<>'pending' then raise exception 'Règlement en attente introuvable'; end if;
  select * into d from public.admin_partner_dossiers where partner_id=r.partner_id;
  update public.partner_subscription_payments
  set status='refused',refused_by=p_admin,refused_at=now(),refusal_reason=v_reason,updated_at=now()
  where id=r.id;
  insert into public.notifications(user_id,type,titre,corps,related_entity_id)
  values(d.promoteur_id,'partner_subscription_payment_refused',
    'Règlement partenaire refusé',
    'Votre règlement n’a pas été confirmé. Motif : '||v_reason||
      '. Votre abonnement n’est pas renouvelé.',r.id);
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(p_admin,'partner_subscription.payment_refused','partner_subscription_payment',r.id::text,
    jsonb_build_object('partner_id',r.partner_id,'reason',v_reason));
  return true;
end;
$fn$;

create or replace function public.synchroniser_validite_abonnements_partenaires()
returns integer
language plpgsql
security definer
set search_path=''
as $fn$
declare n integer;
begin
  update public.partner_subscriptions
  set status='expired',updated_at=now()
  where status='active' and due_date<((now() at time zone 'Africa/Douala')::date);
  get diagnostics n=row_count;
  return n;
end;
$fn$;

create or replace function public.emettre_rappels_abonnements_partenaires_5j()
returns integer
language plpgsql
security definer
set search_path=''
as $fn$
declare
  s record;
  n integer:=0;
begin
  for s in
    select ps.partner_id,ps.due_date,ps.monthly_fee_fcfa,d.promoteur_id,pa.name
    from public.partner_subscriptions ps
    join public.admin_partner_dossiers d on d.partner_id=ps.partner_id
    join public.partners pa on pa.id=ps.partner_id and pa.status='active'
    join public.profiles p on p.id=d.promoteur_id and p.actif=true
    where ps.status='active'
      and ps.first_confirmed_payment_at is not null
      and ps.due_date=((now() at time zone 'Africa/Douala')::date+5)
      and ps.reminder_5d_sent_at is null
    for update of ps skip locked
  loop
    insert into public.notifications(user_id,type,titre,corps,related_entity_id)
    values(s.promoteur_id,'partner_subscription_due_5d',
      'Échéance de votre abonnement dans 5 jours',
      'L’abonnement de '||s.name||' arrive à échéance le '||
        to_char(s.due_date,'DD/MM/YYYY')||'. Montant mensuel : '||
        s.monthly_fee_fcfa::text||' FCFA. Le renouvellement sera pris en compte uniquement après confirmation effective du paiement par NAXA.',
      s.partner_id);
    update public.partner_subscriptions set reminder_5d_sent_at=now(),updated_at=now()
    where partner_id=s.partner_id and reminder_5d_sent_at is null;
    n:=n+1;
  end loop;
  return n;
end;
$fn$;

-- La file email existante est réutilisée : mêmes retries et idempotence,
-- sans exposer d'adresse externe ni détourner les paiements Client.
create or replace function public.enqueue_notification_email()
returns trigger
language plpgsql
security definer
set search_path=''
as $fn$
begin
  if new.user_id is not null and new.type in (
    'abonnement_echeance_5j',
    'abonnement_echeance_5j_admin',
    'abonnement_reglement_a_verifier',
    'abonnement_reglement_soumis',
    'abonnement_reglement_confirme',
    'abonnement_reglement_refuse',
    'partner_subscription_payment_submitted',
    'partner_subscription_payment_admin_review',
    'partner_subscription_payment_confirmed',
    'partner_subscription_payment_refused',
    'partner_subscription_due_5d'
  ) then
    insert into private.notification_email_outbox(notification_id,user_id)
    values(new.id,new.user_id)
    on conflict(notification_id,channel) do nothing;
  end if;
  return new;
end;
$fn$;

revoke all on function public.partner_soumettre_reglement_abonnement(uuid,bigint,text,text,text,timestamptz,text) from public,anon;
grant execute on function public.partner_soumettre_reglement_abonnement(uuid,bigint,text,text,text,timestamptz,text) to authenticated;
revoke all on function public.admin_confirmer_reglement_partenaire(uuid,uuid) from public,anon;
grant execute on function public.admin_confirmer_reglement_partenaire(uuid,uuid) to authenticated;
revoke all on function public.admin_refuser_reglement_partenaire(uuid,uuid,text) from public,anon;
grant execute on function public.admin_refuser_reglement_partenaire(uuid,uuid,text) to authenticated;
revoke all on function public.synchroniser_validite_abonnements_partenaires() from public,anon,authenticated;
grant execute on function public.synchroniser_validite_abonnements_partenaires() to service_role;
revoke all on function public.emettre_rappels_abonnements_partenaires_5j() from public,anon,authenticated;
grant execute on function public.emettre_rappels_abonnements_partenaires_5j() to service_role;

commit;

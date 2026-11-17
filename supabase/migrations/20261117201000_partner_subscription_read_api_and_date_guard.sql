begin;

create index if not exists partner_subscription_payments_partner_created_idx
  on public.partner_subscription_payments(partner_id,created_at desc);
create index if not exists partner_subscription_payments_submitted_by_idx
  on public.partner_subscription_payments(submitted_by);
create index if not exists partner_subscription_payments_confirmed_by_idx
  on public.partner_subscription_payments(confirmed_by);
create index if not exists partner_subscription_payments_refused_by_idx
  on public.partner_subscription_payments(refused_by);

-- Recalcule uniquement l'accès transitoire historique, sans fabriquer de paiement.
update public.partner_subscriptions ps
set legacy_access_until=case
  when pa.status='active' and pu.enabled and ap.statut='actif'
    and ap.echeance >= (now() at time zone 'Africa/Douala')::date
    then ap.echeance
  else null
end,
updated_at=now()
from public.admin_partner_dossiers d
join public.partners pa on pa.id=d.partner_id
join public.partner_universes pu on pu.partner_id=d.partner_id and pu.universe_slug=d.universe_slug
left join public.abonnements_promoteurs ap on ap.promoteur_id=d.promoteur_id
where ps.partner_id=d.partner_id
  and ps.first_confirmed_payment_at is null;

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
          and s.period_start<=(now() at time zone 'Africa/Douala')::date
          and s.due_date>=(now() at time zone 'Africa/Douala')::date)
        or (s.first_confirmed_payment_at is null
          and s.legacy_access_until is not null
          and s.legacy_access_until>=(now() at time zone 'Africa/Douala')::date)
      )
  );
$fn$;

create or replace function public.partner_lire_abonnement(p_partner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_uid uuid:=auth.uid();
  v_result jsonb;
begin
  if v_uid is null or not exists(
    select 1 from public.profiles p where p.id=v_uid and p.actif=true
  ) then raise exception 'Identité active requise' using errcode='42501'; end if;
  if not exists(
    select 1 from public.partner_members pm
    where pm.partner_id=p_partner_id and pm.user_id=v_uid and pm.member_role='owner'
  ) then raise exception 'Lecture réservée au titulaire de la structure' using errcode='42501'; end if;

  select jsonb_build_object(
    'partner_id',pa.id,
    'partner_name',pa.name,
    'universe_slug',d.universe_slug,
    'monthly_fee_fcfa',d.monthly_fee_fcfa,
    'dossier_status',d.dossier_status,
    'subscription',to_jsonb(ps),
    'destinations',coalesce((
      select jsonb_agg(jsonb_build_object(
        'canal',pd.canal,'beneficiaire',pd.beneficiaire,
        'reference_destination',pd.reference_destination,'instructions',pd.instructions
      ) order by pd.canal)
      from public.naxa_payment_destinations pd where pd.actif=true
    ),'[]'::jsonb),
    'payments',coalesce((
      select jsonb_agg(to_jsonb(pmt) order by pmt.created_at desc)
      from (
        select id,amount_fcfa,canal,payer_account,transaction_reference,paid_at,status,
          submitted_at,confirmed_at,refused_at,refusal_reason,period_start,period_end,receipt_number
        from public.partner_subscription_payments
        where partner_id=p_partner_id
        order by created_at desc limit 10
      ) pmt
    ),'[]'::jsonb)
  ) into v_result
  from public.partners pa
  join public.admin_partner_dossiers d on d.partner_id=pa.id
  join public.partner_subscriptions ps on ps.partner_id=pa.id
  where pa.id=p_partner_id and d.universe_slug in ('parapharmacie','examens','prestations');

  if v_result is null then raise exception 'Abonnement partenaire introuvable'; end if;
  return v_result;
end;
$fn$;

create or replace function public.admin_lister_reglements_partenaires(
  p_status text default 'pending'
)
returns table(
  id uuid,
  partner_id uuid,
  partner_name text,
  universe_slug text,
  owner_name text,
  amount_fcfa bigint,
  canal text,
  payer_account text,
  transaction_reference text,
  paid_at timestamptz,
  proof_path text,
  status text,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  receipt_number text,
  refusal_reason text
)
language plpgsql
security definer
set search_path=''
as $fn$
begin
  if auth.uid() is null or not public.is_admin()
    or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.actif=true) then
    raise exception 'Accès administrateur actif requis' using errcode='42501';
  end if;
  if p_status not in ('pending','confirmed','refused','all') then
    raise exception 'Filtre de statut invalide';
  end if;

  return query
  select pmt.id,pmt.partner_id,pa.name,d.universe_slug,
    coalesce(nullif(trim(concat_ws(' ',pr.first_name,pr.last_name)),''),pr.username),
    pmt.amount_fcfa,pmt.canal,pmt.payer_account,pmt.transaction_reference,
    pmt.paid_at,pmt.proof_path,pmt.status,pmt.submitted_at,pmt.confirmed_at,
    pmt.receipt_number,pmt.refusal_reason
  from public.partner_subscription_payments pmt
  join public.partners pa on pa.id=pmt.partner_id
  join public.admin_partner_dossiers d on d.partner_id=pmt.partner_id
  join public.partner_members pm on pm.partner_id=pmt.partner_id and pm.member_role='owner'
  join public.profiles pr on pr.id=pm.user_id
  where p_status='all' or pmt.status=p_status
  order by case when pmt.status='pending' then 0 else 1 end,pmt.submitted_at desc;
end;
$fn$;

revoke all on function public.partner_lire_abonnement(uuid) from public,anon;
grant execute on function public.partner_lire_abonnement(uuid) to authenticated;
revoke all on function public.admin_lister_reglements_partenaires(text) from public,anon;
grant execute on function public.admin_lister_reglements_partenaires(text) to authenticated;

commit;

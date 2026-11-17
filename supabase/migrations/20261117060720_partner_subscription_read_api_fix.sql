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
    select 1 from public.profiles p where p.id=v_uid and p.actif is true
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
          submitted_at,confirmed_at,refused_at,refusal_reason,period_start,period_end,
          receipt_number,created_at
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

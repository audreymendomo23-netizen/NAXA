-- Lot B : contrôle du périmètre Promoteur sur le rapport Livraison réseau.
-- Replay uniquement : naxa-ci-replay-2 (pwfftcsjyeibxxqhwysw).
-- Lecture seule sous JWT simulé ; transaction annulée par ROLLBACK.
begin;

select set_config(
  'request.jwt.claim.sub',
  'b5b79627-46ac-4dea-8ea9-6f0464cb3404',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"b5b79627-46ac-4dea-8ea9-6f0464cb3404","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  v_report jsonb;
  v_monthly jsonb;
  v_count integer;
  v_allowed uuid := '76dd4983-273a-4a83-ae3d-9a7838d3aa35';
  v_outside uuid := 'f97647dc-86d0-4c06-abca-f7bed12b5e6d';
  v_rejected boolean := false;
  v_subscription_total integer;
  v_due_total integer;
begin
  v_report := public.naxa_delivery_fees_report(current_date - 30,current_date,null);
  v_monthly := public.naxa_delivery_monthly_due(date_trunc('month',current_date)::date);

  select count(*) into v_count
  from jsonb_array_elements(v_monthly->'par_pharmacie');

  if v_count <> 3 then
    raise exception 'B_PROMOTEUR_MONTHLY_SCOPE_EXPECTED_3_GOT_%',v_count;
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_monthly->'par_pharmacie') p
    where p->>'pharmacie_id' = v_outside::text
  ) then
    raise exception 'B_PROMOTEUR_MONTHLY_SCOPE_LEAK';
  end if;

  if coalesce((v_monthly->'totaux'->>'commissions_livraison')::integer, -1) <> 0
     or coalesce((v_monthly->'totaux'->>'commissions_deja_reglees')::integer, -1) <> 0 then
    raise exception 'B_PROMOTEUR_MONTHLY_COMMISSION_NOT_ZERO';
  end if;

  select coalesce(sum((p->>'abonnement_mensuel')::integer),0),
         coalesce(sum((p->>'total_mensuel_du')::integer),0)
    into v_subscription_total,v_due_total
  from jsonb_array_elements(v_monthly->'par_pharmacie') p;
  if v_due_total <> v_subscription_total
     or (v_monthly->'totaux'->>'total_a_payer')::integer <> v_subscription_total then
    raise exception 'B_PROMOTEUR_MONTHLY_DUE_MUST_EQUAL_SUBSCRIPTIONS_ONLY';
  end if;

  if position('commission_naxa' in pg_get_functiondef('public.naxa_delivery_monthly_due(date)'::regprocedure)) > 0 then
    raise exception 'B_PROMOTEUR_MONTHLY_FUNCTION_STILL_REFERENCES_NAXA_COMMISSION';
  end if;

  if jsonb_typeof(v_report->'par_pharmacie') <> 'array'
     or jsonb_typeof(v_report->'par_region') <> 'array'
     or not (v_report ? 'totaux') then
    raise exception 'B_PROMOTEUR_DELIVERY_REPORT_SHAPE_INVALID';
  end if;

  -- La pharmacie Mvan appartient au réseau ; Bastos n'y appartient pas.
  perform public.naxa_delivery_fees_report(
    current_date - 30,current_date,v_allowed
  );

  begin
    perform public.naxa_delivery_fees_report(
      current_date - 30,current_date,v_outside
    );
  exception when others then
    if sqlerrm = 'Pharmacie hors réseau Promoteur' then
      v_rejected := true;
    else
      raise;
    end if;
  end;

  if not v_rejected then
    raise exception 'B_PROMOTEUR_OUT_OF_NETWORK_PHARMACY_NOT_REJECTED';
  end if;
end
$$;

select 'LOT_B_PROMOTEUR_DELIVERY_REPORT_NETWORK_SCOPE PASS' as result;
rollback;

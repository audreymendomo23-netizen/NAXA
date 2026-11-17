-- NAXA : aucune commission n'est prélevée sur les frais de livraison.
-- Le décompte mensuel Promoteur ne doit inclure que les abonnements des pharmacies de son réseau.
create or replace function public.naxa_delivery_monthly_due(
  p_month date default date_trunc('month', current_date)::date
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_first date := date_trunc('month', p_month)::date;
  v_last date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_result jsonb;
begin
  if v_uid is null or p_month is null then
    raise exception 'Session et mois requis';
  end if;

  v_role := private.naxa_business_function(v_uid);
  if not public.is_admin() and v_role <> 'promoteur' then
    raise exception 'Décompte mensuel réservé à l’Administration et au Promoteur';
  end if;

  with scope as (
    select
      ph.id as pharmacie_id,
      ph.nom,
      ph.ville,
      coalesce(ab.montant_mensuel, 0)::integer as abonnement_mensuel
    from public.pharmacies ph
    left join lateral (
      select a.montant_mensuel
      from public.abonnements a
      where a.pharmacie_id = ph.id
        and a.statut = 'actif'
      order by a.created_at desc
      limit 1
    ) ab on true
    where ph.actif = true
      and ph.archivee_le is null
      and (
        public.is_admin()
        or exists (
          select 1
          from public.promoteur_pharmacies pp
          where pp.promoteur_id = v_uid
            and pp.pharmacie_id = ph.id
            and pp.actif
        )
      )
  ),
  deliveries as (
    select
      l.pharmacie_id,
      count(*)::integer as livraisons
    from public.naxa_delivery_commission_ledger l
    where l.settlement_month = v_first
    group by l.pharmacie_id
  ),
  detail as (
    select
      s.pharmacie_id,
      s.nom,
      s.ville,
      s.abonnement_mensuel,
      coalesce(d.livraisons, 0) as livraisons,
      0::integer as commission_a_payer,
      0::integer as commission_deja_reglee,
      s.abonnement_mensuel as total_mensuel_du
    from scope s
    left join deliveries d on d.pharmacie_id = s.pharmacie_id
  )
  select jsonb_build_object(
    'periode_du', v_first,
    'periode_au', v_last,
    'totaux', jsonb_build_object(
      'abonnements', coalesce(sum(abonnement_mensuel), 0),
      'commissions_livraison', 0,
      'commissions_deja_reglees', 0,
      'total_a_payer', coalesce(sum(total_mensuel_du), 0),
      'livraisons', coalesce(sum(livraisons), 0)
    ),
    'par_pharmacie', coalesce(
      jsonb_agg(to_jsonb(detail) order by total_mensuel_du desc),
      '[]'::jsonb
    )
  )
  into v_result
  from detail;

  return v_result;
end;
$function$;

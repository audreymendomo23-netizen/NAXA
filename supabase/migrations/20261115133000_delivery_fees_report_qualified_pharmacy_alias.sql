create or replace function public.naxa_delivery_fees_report(
  p_from date default date_trunc('month', current_date)::date,
  p_to date default current_date,
  p_pharmacie uuid default null
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
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'Période de rapport invalide';
  end if;
  v_role := private.naxa_business_function(v_uid);
  if not public.is_admin() and v_role <> 'promoteur' then
    raise exception 'Rapport de frais réservé à l’Administration et au Promoteur';
  end if;
  if v_role = 'promoteur' and p_pharmacie is not null and not exists (
    select 1 from public.promoteur_pharmacies pp
    where pp.promoteur_id = v_uid and pp.pharmacie_id = p_pharmacie and pp.actif
  ) then
    raise exception 'Pharmacie hors réseau Promoteur';
  end if;

  with scoped as (
    select
      l.*,
      ph.nom as pharmacy_name,
      ph.ville as pharmacy_city,
      coalesce(l.region, ph.region, ph.ville, 'Non renseignée') as region_label
    from public.naxa_delivery_commission_ledger l
    join public.pharmacies ph on ph.id = l.pharmacie_id
    where l.delivered_at >= p_from::timestamptz
      and l.delivered_at < (p_to + 1)::timestamptz
      and (p_pharmacie is null or l.pharmacie_id = p_pharmacie)
      and (
        public.is_admin()
        or (
          v_role = 'promoteur'
          and exists (
            select 1 from public.promoteur_pharmacies pp
            where pp.promoteur_id = v_uid and pp.pharmacie_id = l.pharmacie_id and pp.actif
          )
        )
      )
  ),
  by_pharmacy as (
    select pharmacie_id, pharmacy_name as nom, pharmacy_city as ville, region_label,
           count(*)::integer as livraisons,
           sum(frais_livraison_client)::integer as frais_clients,
           sum(solde_livraison)::integer as montant_affecte_service
    from scoped
    group by pharmacie_id, pharmacy_name, pharmacy_city, region_label
  ),
  by_region as (
    select region_label, count(*)::integer as livraisons,
           sum(frais_livraison_client)::integer as frais_clients
    from scoped
    group by region_label
  )
  select jsonb_build_object(
    'periode_du', p_from,
    'periode_au', p_to,
    'totaux', jsonb_build_object(
      'livraisons', coalesce((select sum(livraisons) from by_pharmacy), 0),
      'frais_clients', coalesce((select sum(frais_clients) from by_pharmacy), 0),
      'montant_affecte_service', coalesce((select sum(montant_affecte_service) from by_pharmacy), 0),
      'retenue_naxa', 0
    ),
    'par_pharmacie', coalesce((select jsonb_agg(to_jsonb(x) order by x.frais_clients desc) from by_pharmacy x), '[]'::jsonb),
    'par_region', coalesce((select jsonb_agg(to_jsonb(x) order by x.frais_clients desc) from by_region x), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;

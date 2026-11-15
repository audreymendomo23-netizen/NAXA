begin;

-- Refuse to rewrite any non-zero historical commission records automatically.
do $guard$
begin
  if exists (
    select 1
    from public.naxa_delivery_commission_ledger
    where commission_naxa <> 0
       or solde_livraison <> frais_livraison_client
  ) then
    raise exception
      'Des lignes historiques de commission existent : rapprochement financier manuel requis avant migration.';
  end if;
end
$guard$;

alter table public.naxa_delivery_commission_ledger
  alter column commission_naxa set default 0;

alter table public.naxa_delivery_commission_ledger
  drop constraint if exists naxa_delivery_commission_ledger_commission_naxa_check;
alter table public.naxa_delivery_commission_ledger
  add constraint naxa_delivery_commission_ledger_commission_naxa_check
  check (commission_naxa = 0);

alter table public.naxa_delivery_commission_ledger
  drop constraint if exists naxa_delivery_commission_ledger_solde_livraison_check;
alter table public.naxa_delivery_commission_ledger
  add constraint naxa_delivery_commission_ledger_solde_livraison_check
  check (solde_livraison = frais_livraison_client);

drop trigger if exists trg_naxa_delivery_commission_monthly_settlement
  on public.abonnement_paiements;
drop function if exists private.naxa_delivery_sync_subscription_commission_settlement();

create or replace function private.naxa_delivery_finalize_if_confirmed(p_mission uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_m public.naxa_delivery_missions%rowtype;
  v_r public.reservations%rowtype;
  v_region text;
  v_ville text;
  v_promoteur uuid;
  v_zone_id uuid;
  v_zone_type text := 'standard';
  v_zone_name text;
  v_zone_supplement integer := 0;
  v_formula text := 'progressive_zones_v1';
  v_distance numeric(7,2);
begin
  select * into v_m
  from public.naxa_delivery_missions
  where id = p_mission
  for update;

  if not found or v_m.statut = 'delivered' then
    return found;
  end if;

  if v_m.statut <> 'arrived'
     or v_m.client_confirme_at is null
     or v_m.livreur_confirme_at is null then
    return false;
  end if;

  select * into v_r
  from public.reservations
  where id = v_m.reservation_id
  for update;

  if v_r.paiement_mode is null
     or v_r.paiement_statut is distinct from 'effectue' then
    return false;
  end if;

  select ph.region, ph.ville
    into v_region, v_ville
  from public.pharmacies ph
  where ph.id = v_m.pharmacie_id;

  select pp.promoteur_id
    into v_promoteur
  from public.promoteur_pharmacies pp
  where pp.pharmacie_id = v_m.pharmacie_id
    and pp.actif
  order by pp.created_at asc
  limit 1;

  select q.zone_id,
         coalesce(q.zone_type, 'standard'),
         q.zone_nom_snapshot,
         coalesce(q.zone_supplement_fcfa, 0),
         coalesce(q.formule_version, 'progressive_zones_v1'),
         q.distance_routiere_km
    into v_zone_id, v_zone_type, v_zone_name, v_zone_supplement, v_formula, v_distance
  from public.naxa_delivery_quotes q
  where q.id = v_r.delivery_quote_id;

  v_zone_type := coalesce(v_zone_type, 'standard');
  v_zone_supplement := coalesce(v_zone_supplement, 0);
  v_formula := coalesce(v_formula, 'progressive_zones_v1');
  v_distance := coalesce(v_distance, v_r.distance_livraison_km);

  update public.naxa_delivery_missions
  set statut = 'delivered',
      delivered_at = coalesce(delivered_at, now()),
      updated_at = now()
  where id = p_mission;

  update public.naxa_delivery_mission_offers
  set offer_status = 'delivered',
      delivered_at = coalesce(delivered_at, now())
  where mission_id = p_mission
    and livreur_id = v_m.livreur_id
    and offer_status = 'accepted';

  update public.reservations
  set commande_statut = 'livree'
  where id = v_m.reservation_id;

  insert into public.naxa_delivery_events(
    mission_id, reservation_id, pharmacie_id, actor_id, event_type, label
  )
  values (
    v_m.id, v_m.reservation_id, v_m.pharmacie_id, v_m.livreur_id,
    'delivered', 'Réception Client et Livreur confirmée après paiement validé'
  )
  on conflict do nothing;

  if v_r.frais_livraison between 1500 and 20000 then
    insert into public.naxa_delivery_commission_ledger(
      mission_id, reservation_id, pharmacie_id, promoteur_id, region, ville,
      delivered_at, settlement_month, frais_livraison_client,
      commission_naxa, solde_livraison, distance_livraison_km,
      zone_id, zone_type, zone_nom_snapshot, zone_supplement_fcfa, formule_version
    )
    values (
      v_m.id, v_r.id, v_m.pharmacie_id, v_promoteur, v_region, v_ville,
      coalesce(v_m.delivered_at, now()),
      date_trunc('month', coalesce(v_m.delivered_at, now()))::date,
      v_r.frais_livraison, 0, v_r.frais_livraison,
      v_distance, v_zone_id, v_zone_type, v_zone_name, v_zone_supplement, v_formula
    )
    on conflict (mission_id) do nothing;
  end if;

  return true;
end;
$function$;

comment on function private.naxa_delivery_finalize_if_confirmed(uuid) is
  'Finalise après paiement et confirmations Client/Livreur ; conserve 100 % des frais pour le service de livraison et ne prélève aucune commission NAXA.';

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
    select 1
    from public.promoteur_pharmacies pp
    where pp.promoteur_id = v_uid
      and pp.pharmacie_id = p_pharmacie
      and pp.actif
  ) then
    raise exception 'Pharmacie hors réseau Promoteur';
  end if;

  with scoped as (
    select l.*, ph.nom, ph.ville,
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
            select 1
            from public.promoteur_pharmacies pp
            where pp.promoteur_id = v_uid
              and pp.pharmacie_id = l.pharmacie_id
              and pp.actif
          )
        )
      )
  ),
  by_pharmacy as (
    select pharmacie_id, nom, ville, region_label,
           count(*)::integer as livraisons,
           sum(frais_livraison_client)::integer as frais_clients,
           sum(solde_livraison)::integer as montant_affecte_service
    from scoped
    group by pharmacie_id, nom, ville, region_label
  ),
  by_region as (
    select region_label,
           count(*)::integer as livraisons,
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
    'par_pharmacie', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.frais_clients desc)
      from by_pharmacy x
    ), '[]'::jsonb),
    'par_region', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.frais_clients desc)
      from by_region x
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.naxa_delivery_fees_report(date, date, uuid) from public, anon;
grant execute on function public.naxa_delivery_fees_report(date, date, uuid) to authenticated;

commit;

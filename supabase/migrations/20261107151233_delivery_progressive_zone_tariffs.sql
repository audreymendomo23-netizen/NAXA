-- NAXA — Tarification progressive par distance et géorepérage des zones de livraison.
-- Standard/périurbain : plafond de 3 500 FCFA.
-- Zones éloignées/difficiles : le plafond peut être dépassé selon la distance et la majoration configurée.
-- Commission NAXA : 500 FCFA, incluse dans le prix total Client.

begin;

create table if not exists public.naxa_delivery_tariff_zones (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (length(trim(nom)) between 2 and 120),
  zone_type text not null check (zone_type in ('periurbaine','eloignee','difficile')),
  centre_latitude double precision not null check (centre_latitude between 1.5 and 13.2),
  centre_longitude double precision not null check (centre_longitude between 8.2 and 16.5),
  rayon_km numeric(6,2) not null check (rayon_km > 0 and rayon_km <= 50),
  supplement_fcfa integer not null check (supplement_fcfa between 0 and 5000),
  actif boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists naxa_delivery_tariff_zones_active_idx
  on public.naxa_delivery_tariff_zones (actif, zone_type, supplement_fcfa desc);

alter table public.naxa_delivery_tariff_zones enable row level security;
alter table public.naxa_delivery_tariff_zones force row level security;
revoke all on public.naxa_delivery_tariff_zones from anon, public;
grant select, insert, update, delete on public.naxa_delivery_tariff_zones to authenticated;

drop policy if exists naxa_delivery_tariff_zones_admin_all on public.naxa_delivery_tariff_zones;
create policy naxa_delivery_tariff_zones_admin_all
  on public.naxa_delivery_tariff_zones
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.naxa_delivery_tariff_zones is
  'Cercles géographiques de majoration des frais de livraison. Géofences maintenues par l’Administration; aucune classification approximative n’est appliquée automatiquement.';

alter table public.naxa_delivery_quotes
  add column if not exists zone_id uuid,
  add column if not exists zone_type text not null default 'standard',
  add column if not exists zone_nom_snapshot text,
  add column if not exists zone_supplement_fcfa integer not null default 0,
  add column if not exists formule_version text not null default 'progressive_zones_v1';

alter table public.naxa_delivery_commission_ledger
  add column if not exists distance_livraison_km numeric(7,2),
  add column if not exists zone_id uuid,
  add column if not exists zone_type text not null default 'standard',
  add column if not exists zone_nom_snapshot text,
  add column if not exists zone_supplement_fcfa integer not null default 0,
  add column if not exists formule_version text not null default 'progressive_zones_v1';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='naxa_delivery_quotes_zone_id_fkey'
      and conrelid='public.naxa_delivery_quotes'::regclass
  ) then
    alter table public.naxa_delivery_quotes
      add constraint naxa_delivery_quotes_zone_id_fkey
      foreign key (zone_id) references public.naxa_delivery_tariff_zones(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='naxa_delivery_ledger_zone_id_fkey'
      and conrelid='public.naxa_delivery_commission_ledger'::regclass
  ) then
    alter table public.naxa_delivery_commission_ledger
      add constraint naxa_delivery_ledger_zone_id_fkey
      foreign key (zone_id) references public.naxa_delivery_tariff_zones(id) on delete set null;
  end if;
end $$;

alter table public.naxa_delivery_quotes
  drop constraint if exists naxa_delivery_quotes_frais_livraison_check;
alter table public.naxa_delivery_quotes
  add constraint naxa_delivery_quotes_frais_livraison_check
  check (frais_livraison between 1500 and 20000) not valid;

alter table public.naxa_delivery_commission_ledger
  drop constraint if exists naxa_delivery_commission_ledger_frais_livraison_client_check;
alter table public.naxa_delivery_commission_ledger
  add constraint naxa_delivery_commission_ledger_frais_livraison_client_check
  check (frais_livraison_client between 1500 and 20000) not valid;

alter table public.naxa_delivery_quotes
  drop constraint if exists naxa_delivery_quotes_zone_type_check,
  drop constraint if exists naxa_delivery_quotes_zone_supplement_check;
alter table public.naxa_delivery_quotes
  add constraint naxa_delivery_quotes_zone_type_check
    check (zone_type in ('standard','periurbaine','eloignee','difficile')),
  add constraint naxa_delivery_quotes_zone_supplement_check
    check (zone_supplement_fcfa between 0 and 5000);

alter table public.naxa_delivery_commission_ledger
  drop constraint if exists naxa_delivery_ledger_zone_type_check,
  drop constraint if exists naxa_delivery_ledger_zone_supplement_check;
alter table public.naxa_delivery_commission_ledger
  add constraint naxa_delivery_ledger_zone_type_check
    check (zone_type in ('standard','periurbaine','eloignee','difficile')),
  add constraint naxa_delivery_ledger_zone_supplement_check
    check (zone_supplement_fcfa between 0 and 5000);

-- Empêche l'utilisation de devis calculés avec l'ancienne formule.
update public.naxa_delivery_quotes
set expire_le=now()
where consomme_le is null and expire_le>now();

comment on column public.naxa_delivery_quotes.zone_type is
  'Zone déterminée par géorepérage GPS côté serveur; standard si aucun cercle Admin ne couvre la destination.';
comment on column public.naxa_delivery_quotes.zone_supplement_fcfa is
  'Majoration de zone enregistrée au moment du devis, en FCFA.';
comment on column public.naxa_delivery_quotes.formule_version is
  'Version du barème utilisée pour figer et auditer le devis.';
comment on column public.naxa_delivery_commission_ledger.distance_livraison_km is
  'Distance routière utilisée pour calculer le tarif définitif.';
comment on column public.naxa_delivery_commission_ledger.zone_nom_snapshot is
  'Nom de zone conservé comme instantané pour audit, même si la zone est renommée ou désactivée.';

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
  v_zone_type text:='standard';
  v_zone_name text;
  v_zone_supplement integer:=0;
  v_formula text:='progressive_zones_v1';
  v_distance numeric(7,2);
begin
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if not found or v_m.statut='delivered' then return found; end if;
  if v_m.statut<>'arrived' or v_m.client_confirme_at is null or v_m.livreur_confirme_at is null then
    return false;
  end if;

  select * into v_r from public.reservations where id=v_m.reservation_id for update;
  if v_r.paiement_statut<>'effectue' then return false; end if;

  select ph.region,ph.ville into v_region,v_ville
  from public.pharmacies ph where ph.id=v_m.pharmacie_id;
  select pp.promoteur_id into v_promoteur
  from public.promoteur_pharmacies pp
  where pp.pharmacie_id=v_m.pharmacie_id and pp.actif
  order by pp.created_at asc limit 1;

  select q.zone_id,coalesce(q.zone_type,'standard'),q.zone_nom_snapshot,
         coalesce(q.zone_supplement_fcfa,0),coalesce(q.formule_version,'progressive_zones_v1'),
         q.distance_routiere_km
  into v_zone_id,v_zone_type,v_zone_name,v_zone_supplement,v_formula,v_distance
  from public.naxa_delivery_quotes q
  where q.id=v_r.delivery_quote_id;

  v_zone_type:=coalesce(v_zone_type,'standard');
  v_zone_supplement:=coalesce(v_zone_supplement,0);
  v_formula:=coalesce(v_formula,'progressive_zones_v1');
  v_distance:=coalesce(v_distance,v_r.distance_livraison_km);

  update public.naxa_delivery_missions
  set statut='delivered',delivered_at=coalesce(delivered_at,now()),updated_at=now()
  where id=p_mission;
  update public.naxa_delivery_mission_offers
  set offer_status='delivered',delivered_at=coalesce(delivered_at,now())
  where mission_id=p_mission and livreur_id=v_m.livreur_id and offer_status='accepted';
  update public.reservations set commande_statut='livree' where id=v_m.reservation_id;

  insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label)
  values(v_m.id,v_m.reservation_id,v_m.pharmacie_id,v_m.livreur_id,'delivered','Réception Client et Livreur confirmée après paiement validé')
  on conflict do nothing;

  if v_r.frais_livraison between 1500 and 20000 then
    insert into public.naxa_delivery_commission_ledger(
      mission_id,reservation_id,pharmacie_id,promoteur_id,region,ville,delivered_at,
      settlement_month,frais_livraison_client,commission_naxa,solde_livraison,
      distance_livraison_km,zone_id,zone_type,zone_nom_snapshot,zone_supplement_fcfa,formule_version
    ) values(
      v_m.id,v_r.id,v_m.pharmacie_id,v_promoteur,v_region,v_ville,
      coalesce(v_m.delivered_at,now()),
      date_trunc('month',coalesce(v_m.delivered_at,now()))::date,
      v_r.frais_livraison,500,v_r.frais_livraison-500,
      v_distance,v_zone_id,v_zone_type,v_zone_name,v_zone_supplement,v_formula
    ) on conflict(mission_id) do nothing;
  end if;
  return true;
end;
$function$;

commit;

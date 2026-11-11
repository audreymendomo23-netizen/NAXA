-- NAXA — base schema contract for Marketplace reservations in canonical migration replay.
-- The legacy Supabase schema defines these tables, but the canonical migrations folder
-- previously omitted their creation. This migration must precede the receipt snapshot.
begin;

do $type$
begin
  if to_regtype('public.resa_statut') is null then
    create type public.resa_statut as enum ('en_attente','confirmee','payee','retiree','expiree','annulee');
  end if;
end;
$type$;

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id),
  pharmacie_id uuid not null references public.pharmacies(id),
  statut public.resa_statut not null default 'en_attente',
  total integer not null default 0,
  expires_at timestamptz not null,
  paiement_ref text,
  created_at timestamptz not null default now(),
  mode text not null default 'reservation' check (mode in ('reservation','commande')),
  paiement_statut text not null default 'a_verifier' check (paiement_statut in ('a_verifier','effectue')),
  paiement_mode text check (paiement_mode is null or paiement_mode in ('mtn_marchand','orange_money','especes_retrait','especes_livraison','a_convenir','credit')),
  commande_statut text check (commande_statut is null or commande_statut in ('en_attente_pharmacie','acceptee','preparation','livreur_assigne','en_livraison','livree','annulee')),
  adresse_livraison text,
  quartier_livraison text,
  ville_livraison text,
  repere_livraison text,
  telephone_livraison text,
  latitude_livraison double precision,
  longitude_livraison double precision,
  frais_livraison integer not null default 0 check (frais_livraison >= 0),
  stock_decremented boolean not null default true,
  stock_restored boolean not null default false,
  consumed_by_vente_id uuid,
  consumed_at timestamptz,
  code_paiement text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  paiement_montant_percu integer,
  paiement_monnaie_rendue integer,
  paiement_valide_at timestamptz,
  paiement_ticket_numero text
);

-- Bring older partial tables up to the same column contract without replacing data.
alter table public.reservations
  add column if not exists mode text not null default 'reservation',
  add column if not exists paiement_statut text not null default 'a_verifier',
  add column if not exists paiement_mode text,
  add column if not exists commande_statut text,
  add column if not exists adresse_livraison text,
  add column if not exists quartier_livraison text,
  add column if not exists ville_livraison text,
  add column if not exists repere_livraison text,
  add column if not exists telephone_livraison text,
  add column if not exists latitude_livraison double precision,
  add column if not exists longitude_livraison double precision,
  add column if not exists frais_livraison integer not null default 0,
  add column if not exists stock_decremented boolean not null default true,
  add column if not exists stock_restored boolean not null default false,
  add column if not exists consumed_by_vente_id uuid,
  add column if not exists consumed_at timestamptz,
  add column if not exists code_paiement text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  add column if not exists paiement_montant_percu integer,
  add column if not exists paiement_monnaie_rendue integer,
  add column if not exists paiement_valide_at timestamptz,
  add column if not exists paiement_ticket_numero text;

create table if not exists public.reservation_items (
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  produit_id uuid not null references public.produits(id),
  quantite integer not null check (quantite > 0),
  prix_unitaire integer not null,
  primary key (reservation_id, produit_id)
);

alter table public.reservations enable row level security;
alter table public.reservation_items enable row level security;
drop policy if exists resa_read on public.reservations;
create policy resa_read on public.reservations for select to authenticated
  using (client_id = (select auth.uid()) or pharmacie_id = (select public.my_pharmacie()) or (select public.is_admin()));
drop policy if exists resa_items_read on public.reservation_items;
create policy resa_items_read on public.reservation_items for select to authenticated
  using (exists (
    select 1 from public.reservations r
    where r.id = reservation_id
      and (r.client_id = (select auth.uid()) or r.pharmacie_id = (select public.my_pharmacie()) or (select public.is_admin()))
  ));

grant select on public.reservations, public.reservation_items to authenticated;

comment on table public.reservations is
  'Réservation Marketplace client-pharmacie, y compris parcours de livraison; base schema versionnée pour les environnements Preview.';

commit;

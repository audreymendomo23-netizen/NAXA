-- NAXA Preview: restore the Promoteur schema prerequisites omitted from the
-- legacy root-level migration_*.sql stream.
-- This is schema-only: the historical backfill from public.abonnements is
-- intentionally excluded because that legacy table is not part of the Preview base.
--
-- Keep this migration before 20261022143000_admin_renouvellement_manuel_audit.sql,
-- which declares row variables from conventions_promoteurs and abonnements_promoteurs.

alter type public.role_type add value if not exists 'promoteur';
alter type public.role_type add value if not exists 'caisse';

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone text,
  add column if not exists phone_country text,
  add column if not exists date_of_birth date,
  add column if not exists age_verified boolean not null default false,
  add column if not exists consent_accepted_at timestamptz,
  add column if not exists actif boolean not null default true,
  add column if not exists parent_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists fonction_interne text,
  add column if not exists niveau_interne smallint,
  add column if not exists niveau_hierarchique smallint,
  add column if not exists architecture_code text;

create index if not exists profiles_parent_profile_idx
  on public.profiles(parent_profile_id);

create table if not exists public.promoteur_pharmacies (
  promoteur_id uuid not null references public.profiles(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (promoteur_id, pharmacie_id)
);

create index if not exists promoteur_pharmacies_promoteur_idx
  on public.promoteur_pharmacies(promoteur_id, actif);
create index if not exists promoteur_pharmacies_pharmacie_idx
  on public.promoteur_pharmacies(pharmacie_id, actif);

alter table public.promoteur_pharmacies enable row level security;
drop policy if exists promoteur_pharmacies_read_scope on public.promoteur_pharmacies;
create policy promoteur_pharmacies_read_scope
  on public.promoteur_pharmacies
  for select to authenticated
  using (
    public.is_admin()
    or promoteur_id = (select auth.uid())
    or exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.pharmacie_id = promoteur_pharmacies.pharmacie_id
        and p.actif
        and p.niveau_interne in (2, 3)
    )
  );
revoke all on public.promoteur_pharmacies from anon, authenticated;
grant select on public.promoteur_pharmacies to authenticated;

create table if not exists public.conventions_promoteurs (
  id uuid primary key default gen_random_uuid(),
  promoteur_id uuid not null references public.profiles(id) on delete restrict,
  montant_mensuel integer not null check (montant_mensuel > 0),
  date_paiement date,
  date_expiration date not null,
  statut text not null default 'active'
    check (statut in ('active', 'expiree', 'resiliee')),
  architecture_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists conventions_promoteur_unique
  on public.conventions_promoteurs(promoteur_id);
alter table public.conventions_promoteurs enable row level security;
drop policy if exists conventions_promoteurs_admin on public.conventions_promoteurs;
create policy conventions_promoteurs_admin
  on public.conventions_promoteurs
  for all
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
revoke all on public.conventions_promoteurs from anon, authenticated;
grant select, insert, update on public.conventions_promoteurs to authenticated;

create table if not exists public.abonnements_promoteurs (
  id uuid primary key default gen_random_uuid(),
  promoteur_id uuid not null references public.profiles(id) on delete restrict,
  convention_id uuid not null references public.conventions_promoteurs(id) on delete restrict,
  montant_mensuel integer not null check (montant_mensuel > 0),
  debut date not null default current_date,
  echeance date not null,
  statut text not null default 'actif'
    check (statut in ('actif', 'impaye', 'resilie')),
  created_at timestamptz not null default now(),
  bloque_le timestamptz,
  reactive_le timestamptz,
  reactive_par uuid references public.profiles(id) on delete set null,
  rappel_5j_envoye_at timestamptz,
  rappel_5j_en_cours_at timestamptz
);
create unique index if not exists abonnements_promoteur_unique
  on public.abonnements_promoteurs(promoteur_id);
alter table public.abonnements_promoteurs enable row level security;
drop policy if exists abonnements_promoteurs_admin on public.abonnements_promoteurs;
create policy abonnements_promoteurs_admin
  on public.abonnements_promoteurs
  for all
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
revoke all on public.abonnements_promoteurs from anon, authenticated;
grant select, insert, update on public.abonnements_promoteurs to authenticated;

create table if not exists public.abonnement_promoteur_paiements (
  id uuid primary key default gen_random_uuid(),
  abonnement_id uuid not null references public.abonnements_promoteurs(id) on delete cascade,
  periode_du date not null,
  periode_au date not null,
  montant integer not null check (montant > 0),
  reference text,
  paye_le timestamptz not null default now(),
  enregistre_par uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint abonnement_promoteur_paiement_periode_ck
    check (periode_au >= periode_du)
);
alter table public.abonnement_promoteur_paiements enable row level security;
drop policy if exists abonnement_promoteur_paiements_admin
  on public.abonnement_promoteur_paiements;
create policy abonnement_promoteur_paiements_admin
  on public.abonnement_promoteur_paiements
  for all
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
revoke all on public.abonnement_promoteur_paiements from anon, authenticated;
grant select, insert, update on public.abonnement_promoteur_paiements to authenticated;

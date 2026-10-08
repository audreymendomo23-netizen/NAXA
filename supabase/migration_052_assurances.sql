-- NAXA ERP-008 — Socle assurances / tiers payant
-- Fondation additive : aucun opérateur externe, aucun paiement assureur automatisé.
do $$ begin
  create type public.assurance_dossier_statut as enum ('brouillon','soumis','accepte','refuse','clos');
exception when duplicate_object then null; end $$;

create table if not exists public.assureurs (
 id uuid primary key default gen_random_uuid(),
 nom text not null,
 code text,
 actif boolean not null default true,
 created_at timestamptz not null default now(),
 unique (nom)
);

create table if not exists public.couvertures_assurance (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.profiles(id) on delete restrict,
 assureur_id uuid not null references public.assureurs(id) on delete restrict,
 numero_adherent text not null,
 numero_police text,
 date_debut date,
 date_fin date,
 plafond numeric(14,2),
 taux_prise_en_charge numeric(5,2),
 actif boolean not null default true,
 created_at timestamptz not null default now(),
 check (taux_prise_en_charge is null or (taux_prise_en_charge >= 0 and taux_prise_en_charge <= 100)),
 check (date_fin is null or date_debut is null or date_fin >= date_debut)
);
create index if not exists couvertures_assurance_client_idx on public.couvertures_assurance(client_id);
create index if not exists couvertures_assurance_assureur_idx on public.couvertures_assurance(assureur_id);

create table if not exists public.dossiers_assurance (
 id uuid primary key default gen_random_uuid(),
 pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
 client_id uuid not null references public.profiles(id) on delete restrict,
 couverture_id uuid not null references public.couvertures_assurance(id) on delete restrict,
 vente_id uuid references public.ventes(id) on delete restrict,
 statut public.assurance_dossier_statut not null default 'brouillon',
 montant_total numeric(14,2),
 montant_prise_en_charge numeric(14,2),
 montant_client numeric(14,2),
 reference_externe text,
 motif_refus text,
 soumis_at timestamptz,
 traite_at timestamptz,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 check (montant_total is null or montant_total >= 0),
 check (montant_prise_en_charge is null or montant_prise_en_charge >= 0),
 check (montant_client is null or montant_client >= 0)
);
create index if not exists dossiers_assurance_pharmacie_idx on public.dossiers_assurance(pharmacie_id,created_at desc);
create index if not exists dossiers_assurance_client_idx on public.dossiers_assurance(client_id,created_at desc);

alter table public.assureurs enable row level security;
alter table public.couvertures_assurance enable row level security;
alter table public.dossiers_assurance enable row level security;

revoke all on public.assureurs,public.couvertures_assurance,public.dossiers_assurance from anon,authenticated;
grant select on public.assureurs,public.couvertures_assurance,public.dossiers_assurance to authenticated;

create policy assureurs_read on public.assureurs for select to authenticated using (actif);
create policy couvertures_client_read on public.couvertures_assurance for select to authenticated using ((select auth.uid()) = client_id);
create policy dossiers_assurance_scope_read on public.dossiers_assurance for select to authenticated using (
 (select auth.uid()) = client_id or public.can_access_pharmacy(pharmacie_id)
);

comment on table public.dossiers_assurance is 'Socle interne tiers payant. Les integrations assureur et decisions de remboursement externes restent hors scope tant qu aucun partenaire n est arbitre.';

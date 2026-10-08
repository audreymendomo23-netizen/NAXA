-- NAXA ERP-001 — Catalogue pharmacie avancé
-- Additif : étend la table produits existante et ajoute uniquement la relation d'équivalence absente.
alter table public.produits add column if not exists atc_code text;
alter table public.produits add column if not exists conditionnement text;
alter table public.produits add column if not exists reference_catalogue text;
create index if not exists produits_atc_code_idx on public.produits(atc_code) where atc_code is not null;
create table if not exists public.produit_equivalences (
  produit_id uuid not null references public.produits(id) on delete cascade,
  equivalent_produit_id uuid not null references public.produits(id) on delete cascade,
  type text not null default 'equivalent' check (type in ('equivalent','alternative')),
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (produit_id, equivalent_produit_id),
  check (produit_id <> equivalent_produit_id)
);
alter table public.produit_equivalences enable row level security;
drop policy if exists produit_equivalences_lecture on public.produit_equivalences;
create policy produit_equivalences_lecture on public.produit_equivalences for select to anon, authenticated using (actif = true);
drop policy if exists produit_equivalences_admin on public.produit_equivalences;
create policy produit_equivalences_admin on public.produit_equivalences for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create index if not exists produit_equivalences_inverse_idx on public.produit_equivalences(equivalent_produit_id);
comment on column public.produits.dci is 'Dénomination commune internationale / molécule de référence existante du catalogue.';
comment on column public.produits.atc_code is 'Code ATC du produit lorsque référencé.';
comment on column public.produits.conditionnement is 'Présentation/conditionnement commercial du produit.';
comment on column public.produits.reference_catalogue is 'Référence interne ou catalogue fournisseur, sans remplacer produits.id.';

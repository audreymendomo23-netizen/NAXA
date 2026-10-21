-- NAXA 222 — Référentiel BDPM distinct du catalogue de vente et des stocks.
-- Les spécialités françaises ne prouvent pas une autorisation au Cameroun.
begin;

create table if not exists public.medicaments_referentiel_sources (
  cis text primary key,
  nom text not null,
  forme text,
  voies_administration text,
  statut_amm text,
  etat_commercialisation text,
  date_amm text,
  titulaires text,
  substances_actives text,
  source_nom text not null default 'Base de données publique des médicaments (BDPM)',
  source_url text not null default 'https://base-donnees-publique.medicaments.gouv.fr/telechargement',
  source_dataset_updated_at date,
  imported_at timestamptz not null default now(),
  raw_record jsonb not null default '{}'::jsonb
);

create index if not exists medicaments_referentiel_sources_nom_idx
  on public.medicaments_referentiel_sources (nom);

alter table public.medicaments_referentiel_sources enable row level security;

drop policy if exists medicaments_referentiel_sources_public_read on public.medicaments_referentiel_sources;
create policy medicaments_referentiel_sources_public_read
  on public.medicaments_referentiel_sources for select to anon, authenticated using (true);

grant select on public.medicaments_referentiel_sources to anon, authenticated;
grant select, insert, update on public.medicaments_referentiel_sources to service_role;

comment on table public.medicaments_referentiel_sources is
  'Référentiel de recherche importé de la BDPM française. Source et date du jeu conservées. Ne vaut pas autorisation au Cameroun.';
comment on column public.medicaments_referentiel_sources.source_dataset_updated_at is
  'Date officielle du jeu BDPM importé; NULL si elle n’a pas été confirmée lors de l’import.';
comment on column public.medicaments_referentiel_sources.raw_record is
  'Colonnes brutes BDPM pour audit de fidélité à la source.';

commit;

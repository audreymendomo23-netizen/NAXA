-- NAXA — provenance et validation de la position de chaque pharmacie
-- Additif et isolé : aucune modification des coordonnées existantes ni migration Production.

alter table public.pharmacies
  add column if not exists geo_source_type text,
  add column if not exists geo_verifiee_par uuid references auth.users(id) on delete set null,
  add column if not exists geo_verifiee_le timestamptz;

alter table public.pharmacies drop constraint if exists pharmacies_geo_statut_ck;
alter table public.pharmacies
  add constraint pharmacies_geo_statut_ck
  check (geo_statut in ('inconnu','source_publique_a_confirmer','a_verifier','verifiee_terrain','rejetee')) not valid;

alter table public.pharmacies drop constraint if exists pharmacies_geo_source_type_ck;
alter table public.pharmacies
  add constraint pharmacies_geo_source_type_ck
  check (geo_source_type is null or geo_source_type in ('gps','saisie_manuelle','osm','administration')) not valid;

create table if not exists public.naxa_pharmacie_geo_audit (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  acteur_id uuid references auth.users(id) on delete set null,
  role_acteur text not null check (role_acteur in ('admin','promoteur')),
  event_type text not null check (event_type in ('creation','mise_a_jour','verification')),
  source_type text not null check (source_type in ('gps','saisie_manuelle','osm','administration')),
  latitude_precedente double precision,
  longitude_precedente double precision,
  latitude_nouvelle double precision,
  longitude_nouvelle double precision,
  statut_precedent text,
  statut_nouveau text,
  created_at timestamptz not null default now()
);

create index if not exists naxa_pharmacie_geo_audit_pharmacie_date_idx
  on public.naxa_pharmacie_geo_audit (pharmacie_id, created_at desc);

alter table public.naxa_pharmacie_geo_audit enable row level security;
alter table public.naxa_pharmacie_geo_audit force row level security;
revoke all on public.naxa_pharmacie_geo_audit from public, anon, authenticated;
grant all on public.naxa_pharmacie_geo_audit to service_role;

comment on column public.pharmacies.geo_source_type is
  'Origine des coordonnées : GPS relevé sur place, saisie manuelle, source OSM ou administration.';
comment on column public.pharmacies.geo_statut is
  'inconnu, source_publique_a_confirmer, a_verifier, verifiee_terrain ou rejetee. Une position importée/saisie ne vaut pas vérification terrain.';
comment on table public.naxa_pharmacie_geo_audit is
  'Historique des créations, modifications et certifications des coordonnées de pharmacies. Accessible exclusivement au backend privilégié NAXA.';

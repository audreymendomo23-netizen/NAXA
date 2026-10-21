-- NAXA — synchronisation contrôlée du répertoire public OpenStreetMap.
-- Additif, sans suppression ni création de partenaires pharmacies.
-- Exécuter après migration_071_geolocalisation_pharmacies_yaounde.sql.

alter table public.pharmacies
  add column if not exists geo_source_url text,
  add column if not exists geo_statut text not null default 'inconnu',
  add column if not exists geo_mise_a_jour timestamptz;

create table if not exists public.pharmacies_geolocalisation_referentiel (
  id uuid primary key default gen_random_uuid(),
  nom_source text not null,
  ville text not null default 'Yaoundé',
  quartier text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  categorie text not null check (categorie in ('pharmacie_humaine', 'pharmacie_veterinaire')),
  source_url text not null,
  source_annee integer,
  source_reference text not null,
  statut text not null default 'a_confirmer'
    check (statut in ('a_confirmer', 'confirmee_terrain', 'rejetee')),
  collecte_le date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (nom_source, source_url)
);

create index if not exists pharmacies_geo_ref_ville_idx
  on public.pharmacies_geolocalisation_referentiel (ville, statut);

-- Ligne de contrôle persistante : la synchronisation publique ne tourne pas à chaque recherche.
create table if not exists public.pharmacies_geo_osm_sync (
  id boolean primary key default true check (id = true),
  last_started_at timestamptz,
  last_finished_at timestamptz,
  candidats_importes integer not null default 0 check (candidats_importes >= 0),
  pharmacies_rapprochees integer not null default 0 check (pharmacies_rapprochees >= 0),
  erreur text,
  updated_at timestamptz not null default now()
);

insert into public.pharmacies_geo_osm_sync (id)
values (true)
on conflict (id) do nothing;

alter table public.pharmacies_geolocalisation_referentiel enable row level security;
alter table public.pharmacies_geo_osm_sync enable row level security;

drop policy if exists pharmacies_geo_ref_admin_read on public.pharmacies_geolocalisation_referentiel;
drop policy if exists pharmacies_geo_ref_admin_write on public.pharmacies_geolocalisation_referentiel;
create policy pharmacies_geo_ref_admin_read
  on public.pharmacies_geolocalisation_referentiel
  for select using (public.is_admin());
create policy pharmacies_geo_ref_admin_write
  on public.pharmacies_geolocalisation_referentiel
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists pharmacies_geo_osm_sync_admin_read on public.pharmacies_geo_osm_sync;
create policy pharmacies_geo_osm_sync_admin_read
  on public.pharmacies_geo_osm_sync
  for select using (public.is_admin());

revoke all on public.pharmacies_geolocalisation_referentiel from anon;
revoke all on public.pharmacies_geo_osm_sync from anon, authenticated;
grant select, insert, update, delete on public.pharmacies_geolocalisation_referentiel to authenticated;
grant all on public.pharmacies_geolocalisation_referentiel to service_role;
grant all on public.pharmacies_geo_osm_sync to service_role;

comment on table public.pharmacies_geolocalisation_referentiel is
  'Candidats d''annuaire issus de sources publiques. Ils ne sont pas des pharmacies partenaires NAXA; chaque position doit être confirmée.';
comment on table public.pharmacies_geo_osm_sync is
  'État persistant et temporisation de la synchronisation OSM administrative (une synchronisation par 24 heures).';
comment on column public.pharmacies.geo_source_url is
  'Source publique des coordonnées, notamment une fiche OpenStreetMap.';
comment on column public.pharmacies.geo_statut is
  'inconnu, source_publique_a_confirmer, verifiee_terrain ou rejetee; source publique ne signifie pas validation terrain.';

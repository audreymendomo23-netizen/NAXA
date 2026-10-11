-- NAXA — référentiel de géolocalisation des pharmacies de Yaoundé
-- Additif : les sources publiques ne créent PAS de pharmacies partenaires.
-- Seules les pharmacies déjà présentes avec un nom exact sont rapprochées automatiquement.
-- Les coordonnées restent marquées « source_publique_a_confirmer » jusqu'à validation terrain.

alter table public.pharmacies
  add column if not exists geo_source_url text,
  add column if not exists geo_statut text not null default 'inconnu',
  add column if not exists geo_mise_a_jour timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pharmacies'::regclass
      and conname = 'pharmacies_geo_statut_ck'
  ) then
    alter table public.pharmacies
      add constraint pharmacies_geo_statut_ck
      check (geo_statut in ('inconnu', 'source_publique_a_confirmer', 'verifiee_terrain', 'rejetee')) not valid;
  end if;
end
$$;

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

alter table public.pharmacies_geolocalisation_referentiel enable row level security;
drop policy if exists pharmacies_geo_ref_admin_read on public.pharmacies_geolocalisation_referentiel;
drop policy if exists pharmacies_geo_ref_admin_write on public.pharmacies_geolocalisation_referentiel;
create policy pharmacies_geo_ref_admin_read
  on public.pharmacies_geolocalisation_referentiel
  for select using (public.is_admin());
create policy pharmacies_geo_ref_admin_write
  on public.pharmacies_geolocalisation_referentiel
  for all using (public.is_admin()) with check (public.is_admin());
revoke all on public.pharmacies_geolocalisation_referentiel from anon;
grant select, insert, update, delete on public.pharmacies_geolocalisation_referentiel to authenticated;
grant all on public.pharmacies_geolocalisation_referentiel to service_role;

comment on table public.pharmacies_geolocalisation_referentiel is
  'Référentiel de candidats géolocalisés issus de sources publiques. Les entrées ne sont pas des pharmacies partenaires NAXA.';
comment on column public.pharmacies.geo_statut is
  'inconnu, source_publique_a_confirmer, verifiee_terrain ou rejetee. Une source publique ne signifie pas une vérification terrain.';
comment on column public.pharmacies.geo_source_url is
  'Source de coordonnées utilisées pour cette pharmacie, si connue.';

insert into public.pharmacies_geolocalisation_referentiel
  (nom_source, ville, quartier, latitude, longitude, categorie, source_url, source_annee, source_reference, statut)
values
  ('Pharmacam', 'Yaoundé', 'Yaoundé III', 3.808063, 11.505189, 'pharmacie_humaine', 'https://yaounde3.communes-du-cameroun.cm/wp-content/uploads/2023/06/PCD-CAY3.pdf', 2022, 'PCD Yaoundé III, tableau 19; coordonnées X=longitude, Y=latitude', 'a_confirmer'),
  ('Pharmacam1', 'Yaoundé', 'Yaoundé III', 3.808050, 11.505266, 'pharmacie_humaine', 'https://yaounde3.communes-du-cameroun.cm/wp-content/uploads/2023/06/PCD-CAY3.pdf', 2022, 'PCD Yaoundé III, tableau 19; nom source conservé tel que publié', 'a_confirmer'),
  ('Pharmacie Codex', 'Yaoundé', 'Yaoundé III', 3.808457, 11.509879, 'pharmacie_humaine', 'https://yaounde3.communes-du-cameroun.cm/wp-content/uploads/2023/06/PCD-CAY3.pdf', 2022, 'PCD Yaoundé III, tableau 19; coordonnées X=longitude, Y=latitude', 'a_confirmer'),
  ('Pharmacie d''Olezoa', 'Yaoundé', 'Olezoa', 3.846530, 11.514753, 'pharmacie_humaine', 'https://yaounde3.communes-du-cameroun.cm/wp-content/uploads/2023/06/PCD-CAY3.pdf', 2022, 'PCD Yaoundé III, tableau 19; coordonnées X=longitude, Y=latitude', 'a_confirmer'),
  ('Pharmacie Sainte Bernadette', 'Yaoundé', 'Yaoundé III', 3.852898, 11.498952, 'pharmacie_humaine', 'https://yaounde3.communes-du-cameroun.cm/wp-content/uploads/2023/06/PCD-CAY3.pdf', 2022, 'PCD Yaoundé III, tableau 19; coordonnées X=longitude, Y=latitude', 'a_confirmer'),
  ('Pharmacie vétérinaire Olezoa', 'Yaoundé', 'Olezoa', 3.846480, 11.514733, 'pharmacie_veterinaire', 'https://yaounde3.communes-du-cameroun.cm/wp-content/uploads/2023/06/PCD-CAY3.pdf', 2022, 'PCD Yaoundé III, tableau 19; établissement vétérinaire exclu du rapprochement humain', 'a_confirmer'),
  ('Pharmacie Bethesda (Biyem-Assi Tam-Tam)', 'Yaoundé', 'Biyem-Assi Tam-Tam', 3.832200, 11.488700, 'pharmacie_humaine', 'https://yaounde3.communes-du-cameroun.cm/wp-content/uploads/2023/06/PCD-CAY3.pdf', 2022, 'PCD Yaoundé III, tableau 19; coordonnées X=longitude, Y=latitude', 'a_confirmer'),
  ('Pharmacie Mongale', 'Yaoundé', 'Yaoundé III', 3.816800, 11.503900, 'pharmacie_humaine', 'https://yaounde3.communes-du-cameroun.cm/wp-content/uploads/2023/06/PCD-CAY3.pdf', 2022, 'PCD Yaoundé III, tableau 19; coordonnées X=longitude, Y=latitude', 'a_confirmer'),
  ('Pharmacie d''Ahala', 'Yaoundé', 'Ahala', 3.794700, 11.489900, 'pharmacie_humaine', 'https://yaounde3.communes-du-cameroun.cm/wp-content/uploads/2023/06/PCD-CAY3.pdf', 2022, 'PCD Yaoundé III, tableau 19; coordonnées X=longitude, Y=latitude', 'a_confirmer'),
  ('Pharmacie Mandela', 'Yaoundé', 'Yaoundé III', 3.853700, 11.487000, 'pharmacie_humaine', 'https://yaounde3.communes-du-cameroun.cm/wp-content/uploads/2023/06/PCD-CAY3.pdf', 2022, 'PCD Yaoundé III, tableau 19; coordonnées X=longitude, Y=latitude', 'a_confirmer'),
  ('Pharmacie Essélé', 'Yaoundé', 'Yaoundé III', 3.816900, 11.489500, 'pharmacie_humaine', 'https://yaounde3.communes-du-cameroun.cm/wp-content/uploads/2023/06/PCD-CAY3.pdf', 2022, 'PCD Yaoundé III, tableau 19; coordonnées X=longitude, Y=latitude', 'a_confirmer'),
  ('Pharmacie Camerounaise', 'Yaoundé', 'Centre-ville / avenue Monseigneur Vogt', 3.862910, 11.521440, 'pharmacie_humaine', 'https://mapcarta.com/fr/W410241002', null, 'Fiche cartographique basée sur OpenStreetMap; coordonnées publiées sur la fiche', 'a_confirmer')
on conflict (nom_source, source_url) do update set
  ville = excluded.ville,
  quartier = excluded.quartier,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  categorie = excluded.categorie,
  source_annee = excluded.source_annee,
  source_reference = excluded.source_reference,
  statut = 'a_confirmer',
  updated_at = now();

-- Rapprochement strict : aucun ajout de partenaire et aucun appariement flou.
-- Le statut reste à confirmer : ces positions publiées ne sont pas une validation terrain.
update public.pharmacies ph
set lat = r.latitude,
    lng = r.longitude,
    geo_source_url = r.source_url,
    geo_statut = 'source_publique_a_confirmer',
    geo_mise_a_jour = now()
from public.pharmacies_geolocalisation_referentiel r
where lower(unaccent(trim(ph.nom))) = lower(unaccent(trim(r.nom_source)))
  and lower(unaccent(coalesce(ph.ville, ''))) = 'yaounde'
  and r.categorie = 'pharmacie_humaine'
  and r.statut = 'a_confirmer';

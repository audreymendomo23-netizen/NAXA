-- NAXA — resserrer les politiques du référentiel de géolocalisation.
-- Correction additive : aucune donnée supprimée, droits limités aux administrateurs authentifiés.

drop policy if exists pharmacies_geo_ref_admin_read on public.pharmacies_geolocalisation_referentiel;
drop policy if exists pharmacies_geo_ref_admin_write on public.pharmacies_geolocalisation_referentiel;
drop policy if exists pharmacies_geo_ref_admin_insert on public.pharmacies_geolocalisation_referentiel;
drop policy if exists pharmacies_geo_ref_admin_update on public.pharmacies_geolocalisation_referentiel;
drop policy if exists pharmacies_geo_ref_admin_delete on public.pharmacies_geolocalisation_referentiel;

create policy pharmacies_geo_ref_admin_read
  on public.pharmacies_geolocalisation_referentiel
  for select to authenticated
  using (public.is_admin());

create policy pharmacies_geo_ref_admin_insert
  on public.pharmacies_geolocalisation_referentiel
  for insert to authenticated
  with check (public.is_admin());

create policy pharmacies_geo_ref_admin_update
  on public.pharmacies_geolocalisation_referentiel
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy pharmacies_geo_ref_admin_delete
  on public.pharmacies_geolocalisation_referentiel
  for delete to authenticated
  using (public.is_admin());

drop policy if exists pharmacies_geo_osm_sync_admin_read on public.pharmacies_geo_osm_sync;
create policy pharmacies_geo_osm_sync_admin_read
  on public.pharmacies_geo_osm_sync
  for select to authenticated
  using (public.is_admin());

revoke all on public.pharmacies_geolocalisation_referentiel from anon;
revoke all on public.pharmacies_geo_osm_sync from anon, authenticated;
grant select, insert, update, delete on public.pharmacies_geolocalisation_referentiel to authenticated;
grant all on public.pharmacies_geolocalisation_referentiel to service_role;
grant all on public.pharmacies_geo_osm_sync to service_role;

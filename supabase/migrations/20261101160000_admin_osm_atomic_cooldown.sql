-- NAXA — réservation atomique du créneau de synchronisation OSM.
-- Évite qu'une lecture du cooldown suivie d'une écriture permette deux POST concurrents.
begin;

create or replace function public.admin_try_start_pharmacies_geo_osm_sync()
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_started boolean := false;
begin
  insert into public.pharmacies_geo_osm_sync as current_sync (
    id, last_started_at, last_finished_at,
    candidats_importes, pharmacies_rapprochees, erreur, updated_at
  )
  values (true, now(), null, 0, 0, null, now())
  on conflict (id) do update
    set last_started_at = now(),
        last_finished_at = null,
        candidats_importes = 0,
        pharmacies_rapprochees = 0,
        erreur = null,
        updated_at = now()
    where current_sync.last_started_at is null
       or current_sync.last_started_at <= now() - interval '24 hours'
  returning true into v_started;

  return coalesce(v_started, false);
end;
$function$;

revoke all on function public.admin_try_start_pharmacies_geo_osm_sync() from public, anon, authenticated;
grant execute on function public.admin_try_start_pharmacies_geo_osm_sync() to service_role;

commit;

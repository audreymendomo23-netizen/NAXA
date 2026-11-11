grant select (pharmacie_id, service_slug, status)
on public.pharmacie_services to anon, authenticated;

drop policy if exists pharmacie_services_public_active_bebe_maman_read
on public.pharmacie_services;

create policy pharmacie_services_public_active_bebe_maman_read
on public.pharmacie_services
for select
to anon, authenticated
using (
  service_slug = 'bebe-maman'
  and status = 'active'
  and exists (
    select 1 from public.pharmacies ph
    where ph.id = pharmacie_services.pharmacie_id
      and ph.actif is true and ph.visible_recherche is true
      and ph.est_demo is false and ph.archivee_le is null
  )
);

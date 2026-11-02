-- NAXA — lecture complète du catalogue Examens par l'Administrateur actif.
-- Les politiques restent séparées des droits public et membre partenaire.

drop policy if exists exam_centers_admin_read on public.exam_centers;
create policy exam_centers_admin_read
on public.exam_centers
for select
to authenticated
using (public.is_admin());

drop policy if exists exam_services_admin_read on public.exam_services;
create policy exam_services_admin_read
on public.exam_services
for select
to authenticated
using (public.is_admin());

drop policy if exists exam_packs_admin_read on public.exam_packs;
create policy exam_packs_admin_read
on public.exam_packs
for select
to authenticated
using (public.is_admin());

comment on policy exam_centers_admin_read on public.exam_centers is
  'Lecture administrative des centres dans tous leurs états réservée à un Admin actif.';
comment on policy exam_services_admin_read on public.exam_services is
  'Lecture administrative des examens dans tous leurs états réservée à un Admin actif.';
comment on policy exam_packs_admin_read on public.exam_packs is
  'Lecture administrative des packs dans tous leurs états réservée à un Admin actif.';

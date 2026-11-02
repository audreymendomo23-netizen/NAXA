-- NAXA — Audit 360 Administrateur : aligner les lectures RLS Admin sur le garde Admin actif.
-- public.is_admin() délègue à private.is_admin(), qui vérifie role='admin' ET actif=true.
-- Les politiques Client propriétaire et partenaire autorisé restent inchangées.

drop policy if exists exam_appointments_admin_read on public.exam_appointments;
create policy exam_appointments_admin_read
on public.exam_appointments
for select
to authenticated
using ((select public.is_admin()));

drop policy if exists home_service_requests_admin_read on public.home_service_requests;
create policy home_service_requests_admin_read
on public.home_service_requests
for select
to authenticated
using ((select public.is_admin()));

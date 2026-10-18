-- NAXA 122 — lecture administrative des réservations d'examens.
-- Politique additive et limitée aux profils administrateurs authentifiés.
begin;

drop policy if exists exam_appointments_admin_read on public.exam_appointments;
create policy exam_appointments_admin_read
on public.exam_appointments
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

commit;

-- Restrict pharmacy mutations to authenticated NAXA administrators.
-- The admin predicate remains unchanged; anon must never enter the private helper.
drop policy if exists pharmacies_admin_insert on public.pharmacies;
drop policy if exists pharmacies_admin_update on public.pharmacies;
drop policy if exists pharmacies_admin_delete on public.pharmacies;

create policy pharmacies_admin_insert
  on public.pharmacies
  as permissive
  for insert
  to authenticated
  with check ((select is_admin()));

create policy pharmacies_admin_update
  on public.pharmacies
  as permissive
  for update
  to authenticated
  using ((select is_admin()))
  with check ((select is_admin()));

create policy pharmacies_admin_delete
  on public.pharmacies
  as permissive
  for delete
  to authenticated
  using ((select is_admin()));

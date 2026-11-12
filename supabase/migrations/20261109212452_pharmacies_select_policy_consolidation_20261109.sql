-- Preserve public pharmacy reads while splitting admin writes from SELECT.
-- The former admin ALL policy overlaps the public read policy for active rows.
drop policy if exists pharmacies_admin on public.pharmacies;

create policy pharmacies_admin_insert
  on public.pharmacies
  as permissive
  for insert
  to public
  with check ((select is_admin()));

create policy pharmacies_admin_update
  on public.pharmacies
  as permissive
  for update
  to public
  using ((select is_admin()))
  with check ((select is_admin()));

create policy pharmacies_admin_delete
  on public.pharmacies
  as permissive
  for delete
  to public
  using ((select is_admin()));

-- public.is_admin() is invoker and calls private.is_admin(), which is
-- intentionally not executable by anon. Public reads therefore must not call
-- the private helper when processing inactive pharmacy rows.
drop policy if exists pharmacies_read on public.pharmacies;

create policy pharmacies_read_anon
  on public.pharmacies
  as permissive
  for select
  to anon
  using (actif is true);

create policy pharmacies_read_authenticated
  on public.pharmacies
  as permissive
  for select
  to authenticated
  using (actif is true or (select private.is_admin()));

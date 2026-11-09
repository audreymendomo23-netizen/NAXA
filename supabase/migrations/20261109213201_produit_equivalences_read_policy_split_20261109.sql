-- Remove overlapping Admin ALL and public-equivalence SELECT policies.
-- Anonymous users read only active equivalents without invoking the private admin helper.
-- Authenticated users read active rows; NAXA admins retain visibility of inactive rows.
drop policy if exists produit_equivalences_admin on public.produit_equivalences;
drop policy if exists produit_equivalences_lecture on public.produit_equivalences;

create policy produit_equivalences_read_anon
  on public.produit_equivalences
  as permissive
  for select
  to anon
  using (actif is true);

create policy produit_equivalences_read_authenticated
  on public.produit_equivalences
  as permissive
  for select
  to authenticated
  using (actif is true or (select private.is_admin()));

create policy produit_equivalences_admin_insert
  on public.produit_equivalences
  as permissive
  for insert
  to authenticated
  with check ((select is_admin()));

create policy produit_equivalences_admin_update
  on public.produit_equivalences
  as permissive
  for update
  to authenticated
  using ((select is_admin()))
  with check ((select is_admin()));

create policy produit_equivalences_admin_delete
  on public.produit_equivalences
  as permissive
  for delete
  to authenticated
  using ((select is_admin()));

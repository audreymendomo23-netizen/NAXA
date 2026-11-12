-- Preserve public dictionary reads while removing overlapping SELECT policies.
-- The former dico_admin FOR ALL policy is split into its DML commands only.
-- Its is_admin() authorization predicate is unchanged.
drop policy if exists dico_admin on public.dictionnaire;

create policy dico_admin_insert
  on public.dictionnaire
  as permissive
  for insert
  to public
  with check (public.is_admin());

create policy dico_admin_update
  on public.dictionnaire
  as permissive
  for update
  to public
  using (public.is_admin())
  with check (public.is_admin());

create policy dico_admin_delete
  on public.dictionnaire
  as permissive
  for delete
  to public
  using (public.is_admin());

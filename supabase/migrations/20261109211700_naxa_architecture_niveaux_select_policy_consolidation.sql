-- Preserve authenticated reads while removing the overlapping admin SELECT.
-- Admin write authorization remains identical to the former FOR ALL policy.
drop policy if exists naxa_architecture_niveaux_admin_write
  on public.naxa_architecture_niveaux;

create policy naxa_architecture_niveaux_admin_insert
  on public.naxa_architecture_niveaux
  as permissive
  for insert
  to authenticated
  with check ((select is_admin()));

create policy naxa_architecture_niveaux_admin_update
  on public.naxa_architecture_niveaux
  as permissive
  for update
  to authenticated
  using ((select is_admin()))
  with check ((select is_admin()));

create policy naxa_architecture_niveaux_admin_delete
  on public.naxa_architecture_niveaux
  as permissive
  for delete
  to authenticated
  using ((select is_admin()));

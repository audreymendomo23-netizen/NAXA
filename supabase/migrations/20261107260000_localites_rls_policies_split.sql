-- Politique de lecture publique distincte des écritures réservées à l'administrateur.
begin;
drop policy if exists localites_cameroun_admin_write on public.localites_cameroun;
drop policy if exists localites_cameroun_admin_insert on public.localites_cameroun;
drop policy if exists localites_cameroun_admin_update on public.localites_cameroun;
drop policy if exists localites_cameroun_admin_delete on public.localites_cameroun;

create policy localites_cameroun_admin_insert
  on public.localites_cameroun for insert to authenticated
  with check (public.is_admin());
create policy localites_cameroun_admin_update
  on public.localites_cameroun for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy localites_cameroun_admin_delete
  on public.localites_cameroun for delete to authenticated
  using (public.is_admin());

commit;

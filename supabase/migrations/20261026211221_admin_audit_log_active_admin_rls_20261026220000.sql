-- Le journal administratif est réservé aux comptes Admin actifs.
-- public.is_admin() délègue au prédicat central qui vérifie role='admin' et actif=true.
drop policy if exists audit_log_admin_read on public.audit_log;
create policy audit_log_admin_read
  on public.audit_log
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists audit_log_admin_insert on public.audit_log;
create policy audit_log_admin_insert
  on public.audit_log
  for insert
  to authenticated
  with check (public.is_admin());

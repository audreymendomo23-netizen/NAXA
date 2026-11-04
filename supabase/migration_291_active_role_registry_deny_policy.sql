-- NAXA 291 — policy de refus explicite pour le registre d’espace actif.
-- Les clients ne disposent toujours d’aucun privilège SQL sur cette table ;
-- la politique false ajoute une défense en profondeur et documente l’intention RLS.
begin;

revoke all on public.naxa_profile_active_roles from public,anon,authenticated;
grant all on public.naxa_profile_active_roles to service_role;

drop policy if exists naxa_profile_active_roles_deny_client_access
  on public.naxa_profile_active_roles;
create policy naxa_profile_active_roles_deny_client_access
  on public.naxa_profile_active_roles
  for all
  to authenticated
  using (false)
  with check (false);

commit;

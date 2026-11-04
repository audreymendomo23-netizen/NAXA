-- NAXA 294 — permettre aux gestionnaires autorisés de lire les affectations de leur équipe.
begin;

drop policy if exists naxa_professional_assignments_team_read
  on public.naxa_professional_assignments;

create policy naxa_professional_assignments_team_read
  on public.naxa_professional_assignments
  for select
  to authenticated
  using (
    public.naxa_scope_allows(auth.uid(), pharmacie_id, 'PHARMACIE')
    and public.naxa_has_privilege('VIEW_TEAM', pharmacie_id, 'PHARMACIE')
  );

commit;

-- NAXA 265 — autoriser le Promoteur à affecter des fonctions dans toutes les architectures.
-- Le contrôle individuel du privilège reste exigé par naxa_has_privilege.
begin;

insert into public.naxa_architecture_privileges(
  architecture_code, role_key, privilege_code
)
values
  ('ORPHELIN', 'promoteur', 'ASSIGN_USER_TO_PHARMACY'),
  ('PARENTS_ENFANTS', 'promoteur', 'ASSIGN_USER_TO_PHARMACY'),
  ('PARENTS_AINES_CADETS', 'promoteur', 'ASSIGN_USER_TO_PHARMACY'),
  ('HYBRIDE', 'promoteur', 'ASSIGN_USER_TO_PHARMACY')
on conflict do nothing;

commit;

-- NAXA 145 — A2 ne permet pas d’accréditer un Responsable.
delete from public.naxa_architecture_privileges
where architecture_code='PARENTS_ENFANTS'
  and role_key='promoteur'
  and privilege_code='CREATE_RESPONSABLE';

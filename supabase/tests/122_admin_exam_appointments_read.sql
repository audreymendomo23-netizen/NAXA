-- NAXA 122 — contrôle structurel de la politique de lecture administrative des tickets d'examens.
-- À exécuter dans une base de test après migration_122_exam_appointments_admin_read.sql.
begin;

do $test$
declare
  policy_row record;
begin
  select schemaname, tablename, policyname, roles, cmd, qual
    into policy_row
  from pg_policies
  where schemaname = 'public'
    and tablename = 'exam_appointments'
    and policyname = 'exam_appointments_admin_read';

  if not found then
    raise exception 'Politique exam_appointments_admin_read absente';
  end if;

  if policy_row.cmd <> 'SELECT' then
    raise exception 'La politique administrative doit être limitée à SELECT';
  end if;

  if not ('authenticated' = any(policy_row.roles)) then
    raise exception 'La politique doit viser le rôle authenticated';
  end if;

  if position('admin' in coalesce(policy_row.qual, '')) = 0
     or position('profiles' in coalesce(policy_row.qual, '')) = 0 then
    raise exception 'La politique doit vérifier le rôle admin depuis profiles';
  end if;
end;
$test$;

select true as naxa_122_admin_exam_appointments_read_pass;
rollback;

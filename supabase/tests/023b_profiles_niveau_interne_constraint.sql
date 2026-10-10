-- Vérifie l'unicité de la règle canonique de niveau interne 1..4.
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid='public.profiles'::regclass and conname='profiles_niveau_interne_check'
  ) then
    raise exception 'ancienne contrainte profiles_niveau_interne_check encore présente';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid='public.profiles'::regclass and conname='profiles_niveau_interne_ck'
      and pg_get_constraintdef(oid) like '%niveau_interne >= 1%'
      and pg_get_constraintdef(oid) like '%niveau_interne <= 4%'
  ) then
    raise exception 'contrainte canonique niveau_interne 1..4 absente';
  end if;
end
$$;

select '023b_profiles_niveau_interne_constraint PASS' as resultat;

-- NAXA 145 — vérification des capacités par architecture.
do $test$
begin
 if exists(select 1 from public.naxa_architecture_privileges where architecture_code='PARENTS_ENFANTS' and role_key='promoteur' and privilege_code='CREATE_RESPONSABLE') then
   raise exception '145.1 : A2 ne doit pas exposer CREATE_RESPONSABLE';
 end if;
 if not exists(select 1 from public.naxa_architecture_privileges where architecture_code='PARENTS_AINES_CADETS' and role_key='promoteur' and privilege_code='CREATE_RESPONSABLE') then
   raise exception '145.2 : A3 doit exposer CREATE_RESPONSABLE';
 end if;
end
$test$;
select 'Vérification 145 — privilèges par architecture : PASS' as resultat;

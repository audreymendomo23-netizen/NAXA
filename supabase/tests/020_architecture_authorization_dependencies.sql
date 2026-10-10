-- NAXA N4 — dépendances du moteur architecture/autorisation
select to_regclass('public.naxa_privileges') is not null as naxa_privileges_exists;
select to_regclass('public.naxa_profile_privileges') is not null as naxa_profile_privileges_exists;
select to_regclass('public.naxa_architecture_privileges') is not null as naxa_architecture_privileges_exists;
select to_regprocedure('public.naxa_business_function(uuid)') is not null as naxa_business_function_exists;
select to_regprocedure('public.naxa_can(text,uuid,uuid)') is not null as naxa_can_exists;
select to_regprocedure('public.naxa_grant_privilege(uuid,text,uuid,text)') is not null as naxa_grant_privilege_exists;
select to_regprocedure('public.naxa_has_privilege(text,uuid,text)') is not null as naxa_has_privilege_exists;

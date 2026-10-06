-- NAXA Partie 3/6 — assertions structurelles d'accréditation Responsable.

select 'CREATE_RESPONSABLE catalogue' as check_name,
 exists(select 1 from public.naxa_privileges where code='CREATE_RESPONSABLE' and active) as pass;

select 'A3 CREATE_RESPONSABLE' as check_name,
 exists(select 1 from public.naxa_architecture_privileges where architecture_code='PARENTS_AINES_CADETS' and role_key='promoteur' and privilege_code='CREATE_RESPONSABLE') as pass;

select 'A1/A2 no CREATE_RESPONSABLE' as check_name,
 not exists(select 1 from public.naxa_architecture_privileges where architecture_code in ('ORPHELIN','PARENTS_ENFANTS') and role_key='promoteur' and privilege_code='CREATE_RESPONSABLE') as pass;

select 'Responsable remains internal function' as check_name,
 exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='fonction_interne')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='niveau_interne') as pass;

select 'dedicated function exists' as check_name,
 exists(select 1 from pg_proc where proname='accrediter_responsable') as pass;

select 'anon denied' as check_name,
 not has_function_privilege('anon','public.accrediter_responsable(uuid,uuid)','EXECUTE') as pass;

select 'authenticated allowed' as check_name,
 has_function_privilege('authenticated','public.accrediter_responsable(uuid,uuid)','EXECUTE') as pass;

select 'CREATE_RESPONSABLE gate' as check_name,
 position('CREATE_RESPONSABLE' in pg_get_functiondef('public.accrediter_profile(uuid,uuid,smallint,uuid)'::regprocedure)) > 0 as pass;

select 'commercial validity gate' as check_name,
 position('naxa_promoteur_valide' in pg_get_functiondef('public.accrediter_profile(uuid,uuid,smallint,uuid)'::regprocedure)) > 0 as pass;

select 'pharmacy scope gate' as check_name,
 position('promoteur_pharmacies' in pg_get_functiondef('public.accrediter_profile(uuid,uuid,smallint,uuid)'::regprocedure)) > 0 as pass;

select 'architecture gate' as check_name,
 position('PARENTS_AINES_CADETS' in pg_get_functiondef('public.accrediter_profile(uuid,uuid,smallint,uuid)'::regprocedure)) > 0 as pass;

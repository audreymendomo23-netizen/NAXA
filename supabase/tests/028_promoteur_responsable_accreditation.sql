-- NAXA Partie 3/6 — assertions structurelles d'accréditation Responsable.
-- À exécuter après replay des migrations 013 -> 028 dans une transaction.

select 'CREATE_RESPONSABLE catalogue' as check_name,
  exists(select 1 from public.naxa_privileges where code='CREATE_RESPONSABLE' and active) as pass;

select 'A3 CREATE_RESPONSABLE' as check_name,
  exists(select 1 from public.naxa_architecture_privileges
    where architecture_code='PARENTS_AINES_CADETS'
      and role_key='promoteur'
      and privilege_code='CREATE_RESPONSABLE') as pass;

select 'A1/A2 no CREATE_RESPONSABLE' as check_name,
  not exists(select 1 from public.naxa_architecture_privileges
    where architecture_code in ('ORPHELIN','PARENTS_ENFANTS')
      and role_key='promoteur'
      and privilege_code='CREATE_RESPONSABLE') as pass;

select 'Responsable = fonction interne N2' as check_name,
  exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='fonction_interne')
  and exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='niveau_interne') as pass;

select 'accrediter_responsable existe' as check_name,
  exists(select 1 from pg_proc
    where proname='accrediter_responsable'
      and pg_get_function_identity_arguments(oid)='p_target uuid, p_pharmacie uuid') as pass;

select 'anon interdit' as check_name,
  not has_function_privilege('anon','public.accrediter_responsable(uuid,uuid)','EXECUTE') as pass;

select 'authenticated autorisé' as check_name,
  has_function_privilege('authenticated','public.accrediter_responsable(uuid,uuid)','EXECUTE') as pass;

select 'CREATE_RESPONSABLE gate dans function' as check_name,
  position('CREATE_RESPONSABLE' in pg_get_functiondef(
    'public.accrediter_responsable(uuid,uuid)'::regprocedure
  )) > 0 as pass;

select 'validité Promoteur gate' as check_name,
  position('naxa_promoteur_valide' in pg_get_functiondef(
    'public.accrediter_responsable(uuid,uuid)'::regprocedure
  )) > 0 as pass;

select 'scope pharmacie gate' as check_name,
  position('naxa_scope_allows' in pg_get_functiondef(
    'public.accrediter_responsable(uuid,uuid)'::regprocedure
  )) > 0 as pass;

select 'architecture niveau 2 gate' as check_name,
  position('naxa_architecture_niveaux' in pg_get_functiondef(
    'public.accrediter_responsable(uuid,uuid)'::regprocedure
  )) > 0 as pass;

select 'parent Promoteur obligatoire' as check_name,
  position('parent du Responsable' in pg_get_functiondef(
    'public.accrediter_profile(uuid,uuid,smallint,uuid)'::regprocedure
  )) > 0 as pass;

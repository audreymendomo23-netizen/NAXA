-- NAXA 023 — acceptance checks for Responsable
-- Toutes les lignes doivent retourner true après replay des migrations 013 -> 023.

select 'CREATE_CAISSE catalogue' as check_name,
       exists(select 1 from public.naxa_privileges where code='CREATE_CAISSE') as pass;

select 'SUSPEND_CAISSE catalogue' as check_name,
       exists(select 1 from public.naxa_privileges where code='SUSPEND_CAISSE') as pass;

select 'REACTIVATE_CAISSE catalogue' as check_name,
       exists(select 1 from public.naxa_privileges where code='REACTIVATE_CAISSE') as pass;

select 'A3 Responsable CREATE_CAISSE' as check_name,
       exists(select 1 from public.naxa_architecture_privileges where architecture_code='PARENTS_AINES_CADETS' and role_key='responsable' and privilege_code='CREATE_CAISSE') as pass;

select 'A1/A2 Responsable absent' as check_name,
       not exists(select 1 from public.naxa_architecture_privileges where architecture_code in ('ORPHELIN','PARENTS_ENFANTS') and role_key='responsable') as pass;

select 'Responsable sans gouvernance NAXA' as check_name,
       not exists(select 1 from public.naxa_architecture_privileges where architecture_code='PARENTS_AINES_CADETS' and role_key='responsable' and privilege_code in ('CHANGE_ARCHITECTURE','MANAGE_CONVENTION','MANAGE_TARIFF','MANAGE_NAXA_PRIVILEGES','MANAGE_SYSTEM_ROLES','VIEW_GLOBAL_NETWORK','CREATE_PROMOTEUR')) as pass;

select 'Responsable sans réseau/custom' as check_name,
       not exists(select 1 from public.naxa_role_privileges where role_key='responsable' and privilege_code in ('CREATE_CUSTOM_ROLE','EDIT_CUSTOM_ROLE','DELETE_CUSTOM_ROLE','VIEW_NETWORK_PILOTAGE','VIEW_NETWORK_REPORT')) as pass;

select 'Responsable pilotage pharmacie' as check_name,
       exists(select 1 from public.naxa_architecture_privileges where architecture_code='PARENTS_AINES_CADETS' and role_key='responsable' and privilege_code='VIEW_PHARMACY_PILOTAGE') as pass;

select 'Responsable CA par Caisse' as check_name,
       exists(select 1 from public.naxa_architecture_privileges where architecture_code='PARENTS_AINES_CADETS' and role_key='responsable' and privilege_code='VIEW_CA_BY_CAISSE') as pass;

select 'Responsable pilotage Responsable' as check_name,
       exists(select 1 from public.naxa_architecture_privileges where architecture_code='PARENTS_AINES_CADETS' and role_key='responsable' and privilege_code='VIEW_RESPONSABLE_PILOTAGE') as pass;

select 'Migration 023 functions' as check_name,
       exists(select 1 from pg_proc where proname='naxa_can_manage_team_member')
       and exists(select 1 from pg_proc where proname='naxa_set_caisse_status') as pass;

select 'Privilege target helper' as check_name,
       exists(select 1 from pg_proc where proname='naxa_can_manage_privilege_target') as pass;

select 'RBAC boundary helper' as check_name,
       exists(select 1 from pg_proc where proname='naxa_grant_privilege')
       and exists(select 1 from pg_proc where proname='naxa_revoke_privilege') as pass;

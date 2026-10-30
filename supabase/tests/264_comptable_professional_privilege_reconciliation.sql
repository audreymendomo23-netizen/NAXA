-- Contrat RBAC Comptable : fonction professionnelle + privilège nominatif + scope.
do $test$
declare
  v_def text;
  v_count integer;
begin
  if not exists (
    select 1 from public.naxa_privileges
    where code='MANAGE_ACCOUNTING' and active
  ) then raise exception 'FAIL: MANAGE_ACCOUNTING absent/inactif'; end if;

  if not exists (
    select 1 from public.naxa_role_privileges
    where role_key='comptable' and privilege_code='MANAGE_ACCOUNTING'
  ) then raise exception 'FAIL: mapping fonction Comptable absent'; end if;

  select count(*) into v_count
  from public.naxa_architecture_privileges
  where role_key='comptable' and privilege_code='MANAGE_ACCOUNTING'
    and architecture_code in ('ORPHELIN','PARENTS_ENFANTS','PARENTS_AINES_CADETS','HYBRIDE');
  if v_count <> 4 then raise exception 'FAIL: matrice architecture Comptable incomplète (%/4)',v_count; end if;

  select pg_get_functiondef('private.naxa_has_privilege(text,uuid,text)'::regprocedure)
    into v_def;
  if position('comptable' in v_def)=0
     or position('naxa_custom_roles' in v_def)=0
     or position('naxa_profile_privileges' in v_def)=0
     or position('naxa_scope_allows' in v_def)=0 then
    raise exception 'FAIL: moteur ne distingue pas fonction, rôle personnalisé, attribution nominative et scope';
  end if;

  if has_function_privilege('anon','private.naxa_has_privilege(text,uuid,text)','EXECUTE') then
    raise exception 'FAIL: helper accessible à anon';
  end if;
end
$test$;

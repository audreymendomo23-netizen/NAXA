-- NAXA 134 — régression de sécurité de la révocation des privilèges.
-- Après la migration 149, la logique est privée et la façade publique est invoker.
do $test$
declare
  v_definition text;
  v_public regprocedure := 'public.naxa_revoke_privilege(uuid,text,uuid,text)'::regprocedure;
  v_private regprocedure := 'private.naxa_revoke_privilege(uuid,text,uuid,text)'::regprocedure;
begin
  v_definition := regexp_replace(lower(pg_get_functiondef(v_private)), '\s+', '', 'g');

  if position('p_scopeisnull' in v_definition) = 0 then
    raise exception '134.1 : le scope NULL doit être refusé';
  end if;
  if position('n.delegable=true' in v_definition) = 0
     or position('n.governance=false' in v_definition) = 0
     or position('n.governance_onlyisnottrue' in v_definition) = 0
     or position('n.active=true' in v_definition) = 0 then
    raise exception '134.2 : privilèges actifs, délégables et non-gouvernance requis';
  end if;
  if position('naxa_can_manage_privilege_target' in v_definition) = 0 then
    raise exception '134.3 : la cible doit être contrôlée hiérarchiquement';
  end if;
  if position('naxa_scope_allows' in v_definition) = 0 then
    raise exception '134.4 : la révocation réseau doit vérifier le périmètre';
  end if;
  if (select prosecdef from pg_proc where oid=v_public) then
    raise exception '134.5 : la façade publique doit rester SECURITY INVOKER';
  end if;
  if not has_function_privilege('authenticated',v_public,'EXECUTE')
     or has_function_privilege('anon',v_public,'EXECUTE') then
    raise exception '134.6 : ACL de la façade incorrecte';
  end if;
  if exists (
    select 1 from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where p.oid=v_public and a.grantee=0 and a.privilege_type='EXECUTE'
  ) then
    raise exception '134.7 : PUBLIC ne doit pas pouvoir appeler la façade';
  end if;
end
$test$;
select 'Vérification 134 — garde de révocation : PASS' as resultat;

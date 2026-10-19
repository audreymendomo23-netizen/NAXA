-- NAXA 134 — régression de sécurité de la révocation des privilèges.
-- Vérifie la définition installée et les droits EXECUTE sans écrire en Production.
do $test$
declare
  v_definition text;
  v_signature regprocedure := 'public.naxa_revoke_privilege(uuid,text,uuid,text)'::regprocedure;
begin
  v_definition := lower(pg_get_functiondef(v_signature));

  if position('p_scope is null' in v_definition) = 0 then
    raise exception '134.1 : le scope NULL doit être refusé';
  end if;
  if position('n.delegable = true' in v_definition) = 0
     or position('n.governance = false' in v_definition) = 0
     or position('n.active = true' in v_definition) = 0 then
    raise exception '134.2 : la révocation par un non-admin doit être limitée aux privilèges actifs, délégables et non-gouvernance';
  end if;
  if position('naxa_can_manage_privilege_target' in v_definition) = 0 then
    raise exception '134.3 : la cible doit être contrôlée hiérarchiquement';
  end if;
  if position('naxa_scope_allows' in v_definition) = 0 then
    raise exception '134.4 : la révocation réseau doit vérifier le périmètre';
  end if;
  if not has_function_privilege('authenticated', v_signature, 'EXECUTE') then
    raise exception '134.5 : authenticated doit pouvoir appeler la façade protégée';
  end if;
  if has_function_privilege('anon', v_signature, 'EXECUTE') then
    raise exception '134.6 : anon ne doit pas pouvoir appeler la façade';
  end if;
  if has_function_privilege('public', v_signature, 'EXECUTE') then
    raise exception '134.7 : PUBLIC ne doit pas pouvoir appeler la façade';
  end if;
end
$test$;

select 'Vérification 134 — garde de révocation : PASS' as resultat;

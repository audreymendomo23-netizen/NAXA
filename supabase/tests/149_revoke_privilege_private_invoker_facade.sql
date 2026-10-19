-- NAXA 149 — façade de révocation invoker + garde privée SECURITY DEFINER.
do $test$
declare
  v_public regprocedure := 'public.naxa_revoke_privilege(uuid,text,uuid,text)'::regprocedure;
  v_private regprocedure := 'private.naxa_revoke_privilege(uuid,text,uuid,text)'::regprocedure;
  d text := lower(pg_get_functiondef(v_private));
begin
  if (select prosecdef from pg_proc where oid=v_public) then
    raise exception '149.1 : la façade publique ne doit pas être SECURITY DEFINER';
  end if;
  if not (select prosecdef from pg_proc where oid=v_private) then
    raise exception '149.2 : l’implémentation privée doit être SECURITY DEFINER';
  end if;
  if position('p_scope is null' in d)=0
     or position('n.governance_only is not true' in d)=0
     or position('naxa_can_manage_privilege_target' in d)=0
     or position('naxa_scope_allows' in d)=0 then
    raise exception '149.3 : gardes de paramètre, gouvernance, hiérarchie et réseau requises';
  end if;
  if not has_function_privilege('authenticated',v_public,'EXECUTE')
     or has_function_privilege('anon',v_public,'EXECUTE') then
    raise exception '149.4 : ACL de la façade incorrecte';
  end if;
  if not has_function_privilege('authenticated',v_private,'EXECUTE') then
    raise exception '149.5 : authenticated doit pouvoir appeler l’implémentation via la façade invoker';
  end if;
end
$test$;
select 'Vérification 149 — façade révocation invoker : PASS' as resultat;

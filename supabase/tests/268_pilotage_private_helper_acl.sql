-- NAXA 268 — frontière d'exécution du moteur Pilotage.
do $test$
declare
  v_public regprocedure := 'public.stats_pilotage_scope(integer)'::regprocedure;
  v_private regprocedure := 'private.stats_pilotage_scope(integer)'::regprocedure;
  v_public_def text := lower(pg_get_functiondef(v_public));
begin
  if not (select prosecdef from pg_proc where oid=v_public) then
    raise exception '268.1 : la façade publique doit être SECURITY DEFINER';
  end if;
  if not (select prosecdef from pg_proc where oid=v_private) then
    raise exception '268.2 : le moteur privé doit rester SECURITY DEFINER';
  end if;
  if has_function_privilege('authenticated',v_private,'EXECUTE')
     or has_function_privilege('anon',v_private,'EXECUTE')
     or has_function_privilege('public',v_private,'EXECUTE') then
    raise exception '268.3 : aucun rôle client ne doit exécuter directement le moteur privé';
  end if;
  if not has_function_privilege('authenticated',v_public,'EXECUTE')
     or has_function_privilege('anon',v_public,'EXECUTE')
     or has_function_privilege('public',v_public,'EXECUTE') then
    raise exception '268.4 : seule la façade doit être exécutable par authenticated';
  end if;
  if position('private.stats_pilotage_scope' in v_public_def)=0 then
    raise exception '268.5 : la façade doit appeler le moteur privé';
  end if;
end
$test$;
select 'Vérification 268 — ACL moteur Pilotage privé : PASS' as resultat;

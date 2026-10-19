-- NAXA 152 — helpers de management non SECURITY DEFINER dans le schéma exposé.
do $test$
declare
 v_public regprocedure;
 v_private regprocedure;
begin
 foreach v_public in array array[
  'public.naxa_can_manage_team_member(uuid,uuid)'::regprocedure,
  'public.naxa_can_manage_privilege_target(uuid,uuid)'::regprocedure
 ] loop
  if (select prosecdef from pg_proc where oid=v_public) then raise exception '152.1 : façade % SECURITY DEFINER inattendue',v_public; end if;
  if not has_function_privilege('authenticated',v_public,'EXECUTE') or has_function_privilege('anon',v_public,'EXECUTE') then raise exception '152.2 : ACL incorrecte pour %',v_public; end if;
 end loop;
 v_private:='private.naxa_can_manage_team_member(uuid,uuid)'::regprocedure;
 if not (select prosecdef from pg_proc where oid=v_private) then raise exception '152.3 : implémentation privée doit être SECURITY DEFINER'; end if;
end
$test$;
select 'Vérification 152 — helpers hiérarchiques invoker : PASS' as resultat;

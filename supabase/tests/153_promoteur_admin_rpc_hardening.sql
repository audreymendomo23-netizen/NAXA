-- NAXA 153 — vérification des RPC commerciales d’administration.
do $test$
declare
 d text:=lower(pg_get_functiondef('public.reactiver_promoteur(uuid,text)'::regprocedure));
 v_path text;
begin
 select array_to_string(proconfig,',') into v_path from pg_proc where oid='public.reactiver_promoteur(uuid,text)'::regprocedure;
 if position('set search_path to ''''' in d)=0 and coalesce(v_path,'') not like '%search_path=%' then
   raise exception '153.1 : search_path vide requis sur reactiver_promoteur';
 end if;
 if position('if not public.is_admin()' in d)=0 then raise exception '153.2 : réactivation admin-only'; end if;
 if position('role::text=''promoteur''' in d)=0 then raise exception '153.3 : la cible doit être un Promoteur'; end if;
 if position('c.architecture_code is null' in d)=0 then raise exception '153.4 : convention sans architecture refusée'; end if;
 if has_function_privilege('anon','public.reactiver_promoteur(uuid,text)','EXECUTE') then raise exception '153.5 : anon ne doit pas réactiver un Promoteur'; end if;
 if (select prosecdef from pg_proc where oid='public.validites_promoteurs_admin()'::regprocedure)
    and (select array_to_string(proconfig,',') from pg_proc where oid='public.validites_promoteurs_admin()'::regprocedure) not like '%search_path=%' then
   raise exception '153.6 : search_path admin de validité manquant';
 end if;
end
$test$;
select 'Vérification 153 — RPC commerciales admin-only : PASS' as resultat;

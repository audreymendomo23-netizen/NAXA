begin;
do $test$
begin
 if to_regprocedure('public.gestionnaire_stock_reference_initialiser(uuid,uuid,integer,text)') is null then raise exception 'RPC d’initialisation de référence absente'; end if;
 if has_function_privilege('anon','public.gestionnaire_stock_reference_initialiser(uuid,uuid,integer,text)','EXECUTE') then raise exception 'RPC d’initialisation exposée à anon'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='gestionnaire_stock_reference_initialiser' and pg_get_functiondef(p.oid) like '%fonction_interne%') then raise exception 'Contrôle de rôle absent'; end if;
end;
$test$;
rollback;

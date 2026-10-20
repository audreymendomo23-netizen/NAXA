begin;
do $test$
begin
 if to_regclass('public.gestionnaire_stock_sessions') is null then raise exception 'Table service gestionnaire stock absente'; end if;
 if to_regprocedure('public.gestionnaire_stock_service_ouvrir(uuid)') is null then raise exception 'RPC ouverture service absente'; end if;
 if to_regprocedure('public.gestionnaire_stock_service_fermer(uuid,text)') is null then raise exception 'RPC fermeture service absente'; end if;
 if has_function_privilege('anon','public.gestionnaire_stock_service_ouvrir(uuid)','EXECUTE') then raise exception 'Ouverture accessible à anon'; end if;
end;
$test$;
rollback;

begin;
do $test$
begin
 if to_regclass('public.inventaire_ajustements') is null then raise exception 'Journal des ajustements absent'; end if;
 if to_regprocedure('public.gestionnaire_stock_inventaire_demarrer(uuid,public.inventaire_type,text)') is null then raise exception 'RPC démarrage inventaire absente'; end if;
 if to_regprocedure('public.gestionnaire_stock_inventaire_ajouter_produit(uuid,uuid)') is null then raise exception 'RPC ajout produit inventaire absente'; end if;
 if to_regprocedure('public.gestionnaire_stock_inventaire_compter(uuid,integer)') is null then raise exception 'RPC comptage inventaire absente'; end if;
 if has_function_privilege('anon','public.inventaire_cloturer(uuid)','EXECUTE') then raise exception 'Clôture accessible à anon'; end if;
end;
$test$;
rollback;

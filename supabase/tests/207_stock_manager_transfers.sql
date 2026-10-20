begin;
do $test$
begin
 if to_regclass('public.stock_manager_transfers') is null then raise exception 'Journal de transferts absent'; end if;
 if to_regprocedure('public.gestionnaire_stock_transfert_atomique(uuid,uuid,uuid,integer,uuid,text)') is null then raise exception 'RPC de transfert absente'; end if;
 if has_function_privilege('anon','public.gestionnaire_stock_transfert_atomique(uuid,uuid,uuid,integer,uuid,text)','EXECUTE') then raise exception 'RPC de transfert exposée à anon'; end if;
end;
$test$;
rollback;

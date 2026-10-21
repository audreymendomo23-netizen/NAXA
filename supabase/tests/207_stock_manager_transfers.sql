begin;
do $test$
begin
 if to_regclass('public.stock_manager_transfers') is null then raise exception 'Journal de transferts absent'; end if;
 if to_regprocedure('public.gestionnaire_stock_transfert_atomique(uuid,uuid,uuid,integer,uuid,text)') is null then raise exception 'RPC de transfert absente'; end if;
 if has_function_privilege('anon','public.gestionnaire_stock_transfert_atomique(uuid,uuid,uuid,integer,uuid,text)','EXECUTE') then raise exception 'RPC de transfert exposée à anon'; end if;
 if has_table_privilege('authenticated','public.stock_manager_transfers','INSERT') then raise exception 'Écriture directe du journal de transfert autorisée'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='stock_manager_transfers' and policyname='stock_manager_transfers_scope_read') then raise exception 'Périmètre de lecture des transferts absent'; end if;
end;
$test$;
rollback;

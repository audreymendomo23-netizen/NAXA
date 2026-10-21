begin;
do $test$
begin
 if to_regprocedure('public.gestionnaire_stock_quantite_ajuster(uuid,uuid,integer,text,text,uuid)') is null then raise exception 'RPC de mouvement stock absente'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='stock_manager_movement_journal' and column_name='motif_operation') then raise exception 'Motif non conservé dans le journal'; end if;
 if has_function_privilege('anon','public.gestionnaire_stock_quantite_ajuster(uuid,uuid,integer,text,text,uuid)','EXECUTE') then raise exception 'RPC de mouvement exposée à anon'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='gestionnaire_stock_quantite_ajuster' and pg_get_functiondef(p.oid) like '%naxa_scope_allows%' and pg_get_functiondef(p.oid) like '%naxa.stock_motif%') then raise exception 'Contrôles de périmètre ou journalisation du mouvement absents'; end if;
end;
$test$;
rollback;

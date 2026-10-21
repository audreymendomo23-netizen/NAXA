begin;
do $test$
begin
 if to_regclass('public.stock_manager_movement_journal') is null then raise exception 'Journal des mouvements de stock absent'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='stock_manager_movement_journal' and column_name='numero_lot') then raise exception 'Numéro de lot non conservé dans le journal'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='stock_manager_movement_journal' and column_name='motif_operation') then raise exception 'Motif de mouvement non conservé dans le journal'; end if;
 if not exists(select 1 from pg_trigger where tgname='trg_journal_stock_manager_stocks' and tgrelid='public.stocks'::regclass) then raise exception 'Journal stock agrégé non branché'; end if;
 if not exists(select 1 from pg_trigger where tgname='trg_journal_stock_manager_lots' and tgrelid='public.stocks_lots'::regclass) then raise exception 'Journal des lots non branché'; end if;
 if has_table_privilege('authenticated','public.stock_manager_movement_journal','INSERT') then raise exception 'Écriture directe autorisée dans le journal'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='stock_manager_movement_journal' and policyname='stock_manager_movement_journal_read_scope') then raise exception 'Périmètre RLS du journal absent'; end if;
end;
$test$;
rollback;

begin;
do $test$
begin
 if to_regprocedure('private.naxa_bloquer_mouvement_stock_pendant_inventaire()') is null then raise exception 'Garde inventaire absent'; end if;
 if not exists(select 1 from pg_trigger where tgname='trg_stock_quantity_blocked_during_inventory' and tgrelid='public.stocks'::regclass) then raise exception 'Garde de quantité stock absent'; end if;
 if not exists(select 1 from pg_trigger where tgname='trg_stock_lot_quantity_blocked_during_inventory' and tgrelid='public.stocks_lots'::regclass) then raise exception 'Garde de quantité lot absent'; end if;
 if has_function_privilege('authenticated','private.naxa_bloquer_mouvement_stock_pendant_inventaire()','EXECUTE') then raise exception 'Fonction trigger exposée aux comptes applicatifs'; end if;
end;
$test$;
rollback;

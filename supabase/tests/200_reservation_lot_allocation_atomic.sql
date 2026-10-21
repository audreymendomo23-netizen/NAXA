begin;
do $test$
begin
 if to_regclass('public.reservation_item_lots') is null then raise exception 'Allocation de lots par réservation absente'; end if;
 if to_regprocedure('private.reserve_stock(uuid,jsonb)') is null then raise exception 'RPC interne de réservation absente'; end if;
 if to_regprocedure('public.restore_stock(uuid)') is null then raise exception 'RPC de restitution absente'; end if;
 if to_regprocedure('private.naxa_guard_lot_creation_with_unallocated_reservations()') is null then raise exception 'Garde de création de lot absent'; end if;
 if not exists(select 1 from pg_trigger where tgname='trg_stock_lot_requires_active_reservation_allocation' and tgrelid='public.stocks_lots'::regclass) then raise exception 'Garde de création de lot absent'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='reserve_stock' and pg_get_functiondef(p.oid) like '%stock_decremented = false%') then raise exception 'La réservation moderne doit créer un hold sans débit physique'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='naxa_guard_lot_creation_with_unallocated_reservations' and pg_get_functiondef(p.oid) like '%stock_decremented is true%') then raise exception 'La garde doit uniquement bloquer les anciennes réservations déjà débitées'; end if;
 if has_function_privilege('authenticated','public.restore_stock(uuid)','EXECUTE') then raise exception 'La restitution interne ne doit pas être appelable directement par authenticated'; end if;
end;
$test$;
rollback;

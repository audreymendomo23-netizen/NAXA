-- NAXA 276 — restaurer le trigger de protection des premiers lots sans réécrire le moteur moderne de réservation.
begin;

do $guard$
begin
  if to_regprocedure('private.naxa_guard_lot_creation_with_unallocated_reservations()') is null then
    raise exception 'La fonction de garde de création de lot doit être installée avant le trigger';
  end if;
end;
$guard$;

drop trigger if exists trg_stock_lot_requires_active_reservation_allocation on public.stocks_lots;
create trigger trg_stock_lot_requires_active_reservation_allocation
before insert on public.stocks_lots
for each row
execute function private.naxa_guard_lot_creation_with_unallocated_reservations();

commit;

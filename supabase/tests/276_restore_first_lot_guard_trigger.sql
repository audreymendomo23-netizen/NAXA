begin;
do $test$
declare
  v_trigger record;
  v_definition text;
begin
  select t.tgtype,pg_get_triggerdef(t.oid) as definition into v_trigger
  from pg_trigger t
  where t.tgrelid='public.stocks_lots'::regclass
    and t.tgname='trg_stock_lot_requires_active_reservation_allocation'
    and not t.tgisinternal;
  if not found then raise exception 'Trigger de garde du premier lot absent'; end if;
  if position('BEFORE INSERT' in v_trigger.definition)=0
    or position('naxa_guard_lot_creation_with_unallocated_reservations' in v_trigger.definition)=0 then
    raise exception 'Le trigger doit appeler la fonction de garde avant insertion';
  end if;
  v_definition:=pg_get_functiondef('private.naxa_guard_lot_creation_with_unallocated_reservations()'::regprocedure);
  if position('stock_decremented is true' in v_definition)=0 then
    raise exception 'La garde ne doit bloquer que les anciennes réservations déjà débitées';
  end if;
end;
$test$;
rollback;
select '276_restore_first_lot_guard_trigger PASS' as resultat;

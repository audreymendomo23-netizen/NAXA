begin;
do $test$
begin
 if to_regprocedure('public.gestionnaire_stock_reservation_confirmer(uuid)') is null then raise exception 'RPC de confirmation absente'; end if;
 if to_regclass('public.reservation_item_lots') is null then raise exception 'Allocation de lots absente; appliquer migration 200 avant 201'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='gestionnaire_stock_reservation_confirmer' and pg_get_functiondef(p.oid) like '%reservation_item_lots%') then raise exception 'La confirmation ne vérifie pas les allocations réelles'; end if;
end;
$test$;
rollback;

begin;
do $test$
begin
 if to_regprocedure('public.gestionnaire_stock_reservation_confirmer(uuid)') is null then raise exception 'RPC de confirmation réservation absente'; end if;
 if has_function_privilege('anon','public.gestionnaire_stock_reservation_confirmer(uuid)','EXECUTE') then raise exception 'Confirmation accessible à anon'; end if;
end;
$test$;
rollback;

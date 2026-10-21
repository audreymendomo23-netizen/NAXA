begin;
do $test$
begin
 if to_regprocedure('public.expirer_reservations_cron(integer)') is null then raise exception 'RPC cron d’expiration absente'; end if;
 if not has_function_privilege('service_role','public.expirer_reservations_cron(integer)','EXECUTE') then raise exception 'Le scheduler serveur ne peut pas expirer les réservations'; end if;
 if has_function_privilege('authenticated','public.expirer_reservations_cron(integer)','EXECUTE') then raise exception 'L’expiration cron est accessible aux utilisateurs'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='expirer_reservations_cron' and pg_get_functiondef(p.oid) like '%restore_stock%') then raise exception 'La restitution de stock n’est pas branchée sur l’expiration'; end if;
end;
$test$;
rollback;

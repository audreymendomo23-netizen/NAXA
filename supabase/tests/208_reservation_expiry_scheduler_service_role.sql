begin;
do $test$
begin
 if to_regprocedure('public.notifier_reservations_expirant_30m()') is null then raise exception 'Fonction de rappel d’expiration absente'; end if;
 if not has_function_privilege('service_role','public.notifier_reservations_expirant_30m()','EXECUTE') then raise exception 'Le scheduler serveur ne peut pas exécuter le rappel'; end if;
 if has_function_privilege('authenticated','public.notifier_reservations_expirant_30m()','EXECUTE') then raise exception 'Le rappel ne doit pas être appelable par un utilisateur connecté'; end if;
end;
$test$;
rollback;

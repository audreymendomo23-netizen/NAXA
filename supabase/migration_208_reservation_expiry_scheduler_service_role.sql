-- NAXA 208 — autoriser uniquement le rôle serveur de confiance à exécuter le rappel via l’API cron.
begin;
grant execute on function public.notifier_reservations_expirant_30m() to service_role;
commit;

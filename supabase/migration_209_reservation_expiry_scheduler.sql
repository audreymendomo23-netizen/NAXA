-- NAXA 209 — planification serveur de l'expiration et de la restitution du stock.
-- Migration additive : ne pas exécuter manuellement en production sans autorisation.
-- Si pg_cron n'est pas disponible, l'endpoint /api/cron/reservation-expiry doit
-- être appelé par un ordonnanceur externe avec Authorization: Bearer CRON_SECRET.

begin;

do $schedule$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (
      select 1 from cron.job where jobname = 'naxa-reservation-expiry-release'
    ) then
      perform cron.schedule(
        'naxa-reservation-expiry-release',
        '*/5 * * * *',
        'select public.expirer_reservations_cron(p_limit := 500);'
      );
    end if;
  else
    raise notice 'pg_cron absent : configurer un ordonnanceur externe pour /api/cron/reservation-expiry.';
  end if;
exception
  when undefined_table or insufficient_privilege or feature_not_supported then
    raise notice 'Planification pg_cron indisponible : configurer un ordonnanceur externe pour /api/cron/reservation-expiry.';
end;
$schedule$;

comment on function public.expirer_reservations_cron(integer) is
  'Expiration périodique des réservations et restitution idempotente du stock; exécutée par pg_cron toutes les 5 minutes ou par un ordonnanceur externe sécurisé.';

commit;

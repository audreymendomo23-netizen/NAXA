-- NAXA — retrait du dispatcher Push pg_net qui appelait une Preview protégée par SSO.
-- Précondition : le projet Google Apps Script doit avoir été mis à jour et publié
-- avec processNaxaNotificationQueue appelant /api/cron/validite ET /api/cron/posologie.
-- Ne pas appliquer avant confirmation de cette publication : le déclencheur Google
-- devient alors le dispatcher commun toutes les 5 minutes.

begin;

do $retire_protected_preview_job$
declare
  v_job_id bigint;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;

  for v_job_id in
    execute 'select jobid from cron.job where jobname = $1'
    using 'naxa-posology-web-push-every-five-minutes'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$retire_protected_preview_job$;

commit;

-- NAXA — contract test for Android/PWA cycling speed persistence and consent mapping.
do $$
declare
  measurement_ok boolean;
  reminder_ok boolean;
  alert_ok boolean;
begin
  select exists (
    select 1 from pg_constraint
    where conrelid='public.suivi_measurements'::regclass
      and conname='suivi_measurements_measurement_type_check'
      and pg_get_constraintdef(oid) like '%vitesse_cyclisme%'
  ) into measurement_ok;
  if not measurement_ok then raise exception 'vitesse_cyclisme is not accepted by suivi_measurements'; end if;

  select exists (
    select 1 from pg_constraint
    where conrelid='public.suivi_reminders'::regclass
      and conname='suivi_reminders_measurement_type_check'
      and pg_get_constraintdef(oid) like '%vitesse_cyclisme%'
  ) into reminder_ok;
  if not reminder_ok then raise exception 'vitesse_cyclisme is not accepted by suivi_reminders'; end if;

  select exists (
    select 1 from pg_constraint
    where conrelid='public.suivi_alert_rules'::regclass
      and conname='suivi_alert_rules_measurement_type_check'
      and pg_get_constraintdef(oid) like '%vitesse_cyclisme%'
  ) into alert_ok;
  if not alert_ok then raise exception 'vitesse_cyclisme is not accepted by suivi_alert_rules'; end if;

  if public.suivi_measurement_family('vitesse_cyclisme') <> 'activite'
     or public.suivi_measurement_family('vitesse_course') <> 'activite'
     or public.suivi_measurement_family('cadence_course') <> 'activite'
     or public.suivi_measurement_family('longueur_foulee') <> 'activite' then
    raise exception 'Bluetooth activity metrics do not map to the activity consent family';
  end if;
end $$;
select 'naxa_20261114031521_suivi_android_bluetooth_activity_metrics_pass' as test, true as passed;

-- NAXA 150 — tests SQL des mesures complémentaires pour le suivi multi-dispositifs.
do $$
declare
  measurement_ok boolean;
  reminder_ok boolean;
  alert_ok boolean;
  families_ok boolean;
begin
  select count(*)=10 from unnest(array['debit_expiratoire','ecg_note','masse_grasse','masse_musculaire','masse_osseuse','cetonemie','acide_urique','cholesterol_hdl','cholesterol_ldl','capacite_vitale']) k
  into measurement_ok;
  if not measurement_ok then raise exception 'New device measurement types missing from test'; end if;

  if not exists (select 1 from pg_constraint where conrelid='public.suivi_measurements'::regclass and conname='suivi_measurements_measurement_type_check' and pg_get_constraintdef(oid) like '%capacite_vitale%') then
    raise exception 'Measurement constraint not expanded';
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.suivi_reminders'::regclass and conname='suivi_reminders_measurement_type_check' and pg_get_constraintdef(oid) like '%debit_expiratoire%') then
    raise exception 'Reminder constraint not expanded';
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.suivi_alert_rules'::regclass and conname='suivi_alert_rules_measurement_type_check' and pg_get_constraintdef(oid) like '%masse_grasse%') then
    raise exception 'Alert rule constraint not expanded';
  end if;

  select public.suivi_measurement_family('debit_expiratoire')='constantes'
    and public.suivi_measurement_family('masse_grasse')='metabolisme'
    and public.suivi_measurement_family('cetonemie')='metabolisme'
    and public.suivi_measurement_family('sommeil_heures')='sommeil'
  into families_ok;
  if not families_ok then raise exception 'Measurement consent family mapping incorrect'; end if;
end $$;
select 'naxa_150_extended_measurement_types_pass' as test, true as passed;
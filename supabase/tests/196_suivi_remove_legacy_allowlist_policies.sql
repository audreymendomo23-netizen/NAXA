-- NAXA 196 — aucune politique legacy des mesures/alertes ne doit dépendre de l'allowlist.
do $test$
declare
  v_measurement_policy text;
  v_alert_policy text;
begin
  select qual into v_measurement_policy from pg_policies
  where schemaname='public' and tablename='suivi_measurements'
    and policyname='suivi_measurements_recipient_shared_select';
  if v_measurement_policy is not null then
    raise exception 'NAXA 196: la politique legacy des mesures doit être supprimée';
  end if;
  select coalesce(qual,'') || ' ' || coalesce(with_check,'') into v_alert_policy
  from pg_policies where schemaname='public' and tablename='suivi_alerts'
    and policyname='suivi_alerts_self';
  if v_alert_policy is null or position('suivi_is_enabled_user' in v_alert_policy)=0
     or position('is_suivi_test_account' in v_alert_policy)>0 then
    raise exception 'NAXA 196: la politique propriétaire des alertes doit utiliser le flag global sans allowlist';
  end if;
end;
$test$;
select true as naxa_196_legacy_allowlist_policies_removed;

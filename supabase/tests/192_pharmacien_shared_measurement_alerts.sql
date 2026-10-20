-- NAXA 192 — vérifie l'accès professionnel aux alertes partagées et la politique consolidée des mesures.
do $test$
declare
  v_measurement_policy text;
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='suivi_alerts'
      and policyname='suivi_alerts_recipient_shared_select' and cmd='SELECT'
  ) then raise exception 'NAXA 192: politique de lecture des alertes partagées absente'; end if;
  select coalesce(qual,'') into v_measurement_policy from pg_policies
  where schemaname='public' and tablename='suivi_measurements'
    and policyname='suivi_measurements_owner_select' and cmd='SELECT';
  if v_measurement_policy is null
     or position('suivi_is_verified_professional' in v_measurement_policy)=0
     or position('suivi_has_consent' in v_measurement_policy)=0
     or position('suivi_shares' in v_measurement_policy)=0
     or position('suivi_is_enabled_user' in v_measurement_policy)=0 then
    raise exception 'NAXA 192: politique consolidée de lecture des mesures partagées absente ou incomplète';
  end if;
end;
$test$;
select true as naxa_192_pharmacien_shared_measurement_alerts_pass;

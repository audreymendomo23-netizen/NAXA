-- NAXA 192 — vérifie l'accès professionnel aux alertes partagées.
do $test$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='suivi_alerts'
      and policyname='suivi_alerts_recipient_shared_select' and cmd='SELECT'
  ) then raise exception 'NAXA 192: politique de lecture des alertes partagées absente'; end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='suivi_measurements'
      and policyname='suivi_measurements_recipient_shared_select' and cmd='SELECT'
  ) then raise exception 'NAXA 192: politique de lecture des mesures partagées absente'; end if;
end;
$test$;
select true as naxa_192_pharmacien_shared_measurement_alerts_pass;

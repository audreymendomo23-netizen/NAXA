-- NAXA 189 — vérifie que la lecture professionnelle des mesures est liée au partage actif et au consentement.
do $test$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='suivi_measurements'
      and policyname='suivi_measurements_recipient_shared_select'
      and cmd='SELECT'
  ) then raise exception 'NAXA 189: policy SELECT destinataire des mesures partagées absente'; end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='suivi_shares'
      and policyname='suivi_shares_recipient_select'
      and cmd='SELECT'
  ) then raise exception 'NAXA 189: policy de lecture du partage destinataire absente'; end if;
  if to_regprocedure('public.suivi_has_consent(uuid,text)') is null
     or to_regprocedure('public.suivi_measurement_family(text)') is null
     or to_regprocedure('public.suivi_is_verified_professional(uuid)') is null
     or to_regprocedure('public.is_suivi_test_account(uuid)') is null then
    raise exception 'NAXA 189: une fonction de contrôle du consentement ou du professionnel manque';
  end if;
end;
$test$;
select true as naxa_189_pharmacien_read_consented_measurements_pass;

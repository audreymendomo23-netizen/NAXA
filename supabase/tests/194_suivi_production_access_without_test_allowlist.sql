-- NAXA 194 — contrôles structurels des accès de production au suivi connecté.
-- Les scénarios d'identités réelles/RLS doivent aussi être exécutés dans une base de test Supabase.
do $test$
declare
  v_helper text := pg_get_functiondef('public.suivi_is_enabled_user(uuid)'::regprocedure);
  v_measurements text;
  v_shares text;
  v_alerts text;
begin
  if position('feature_flags' in lower(v_helper)) = 0
     or position('suivi_connecte' in lower(v_helper)) = 0
     or position('auth.uid()' in lower(v_helper)) = 0 then
    raise exception 'NAXA 194: helper doit exiger utilisateur courant et drapeau global actif';
  end if;
  if position('is_suivi_test_account' in lower(v_helper)) > 0 then
    raise exception 'NAXA 194: helper production ne doit pas dépendre de l’allowlist de tests';
  end if;

  select qual into v_measurements from pg_policies
   where schemaname='public' and tablename='suivi_measurements'
     and policyname='suivi_measurements_owner_select';
  if v_measurements is null
     or position('suivi_is_verified_professional' in lower(v_measurements)) = 0
     or position('suivi_has_consent' in lower(v_measurements)) = 0
     or position('suivi_shares' in lower(v_measurements)) = 0 then
    raise exception 'NAXA 194: lecture professionnelle des mesures sans partage/consentement vérifié';
  end if;
  if position('is_suivi_test_account' in lower(v_measurements)) > 0 then
    raise exception 'NAXA 194: lecture des mesures encore liée à l’allowlist';
  end if;

  select with_check into v_shares from pg_policies
   where schemaname='public' and tablename='suivi_shares'
     and policyname='suivi_shares_owner_insert';
  if v_shares is null
     or position('suivi_has_consent' in lower(v_shares)) = 0
     or position('suivi_is_verified_professional' in lower(v_shares)) = 0 then
    raise exception 'NAXA 194: création du partage sans consentement/professionnel vérifié';
  end if;
  if position('is_suivi_test_account' in lower(v_shares)) > 0 then
    raise exception 'NAXA 194: création du partage encore liée à l’allowlist';
  end if;

  select qual into v_alerts from pg_policies
   where schemaname='public' and tablename='suivi_alerts'
     and policyname='suivi_alerts_recipient_shared_select';
  if v_alerts is null
     or position('suivi_has_consent' in lower(v_alerts)) = 0
     or position('suivi_shares' in lower(v_alerts)) = 0 then
    raise exception 'NAXA 194: lecture des alertes sans consentement/partage';
  end if;
end;
$test$;
select true as naxa_194_suivi_production_access_pass;

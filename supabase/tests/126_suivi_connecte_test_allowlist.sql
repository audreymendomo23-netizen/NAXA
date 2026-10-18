-- Test ciblé NAXA 126 : schéma, RLS, consentement et allowlist du suivi connecté.
do $test$
declare
  required_tables integer;
  enabled_flag boolean;
  guard_count integer;
  test_accounts integer;
  bad_policies integer;
begin
  select count(*) into required_tables from information_schema.tables
  where table_schema='public' and table_name in (
    'suivi_profiles','suivi_consents','suivi_measurements','suivi_reminders','suivi_professionals','suivi_shares'
  );
  if required_tables <> 6 then raise exception 'NAXA 126: 6 tables attendues, trouvé %', required_tables; end if;

  select enabled into enabled_flag from public.feature_flags where flag_key='suivi_connecte';
  if enabled_flag is distinct from true then raise exception 'NAXA 126: drapeau suivi_connecte doit être actif pour la cohorte expérimentale'; end if;

  select count(*) into guard_count from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid=t.tgrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and not t.tgisinternal and t.tgname in (
    'guard_medical_devices_universe_phase1','guard_medical_devices_flag_phase1',
    'guard_medical_devices_partner_universe_phase1','guard_medical_devices_product_phase1'
  );
  if guard_count <> 4 then raise exception 'NAXA 126: les 4 verrous de l’univers commercial doivent rester présents'; end if;

  if (select enabled from public.universes where slug='suivi') is distinct from false then
    raise exception 'NAXA 126: l’univers commercial suivi doit rester désactivé';
  end if;

  select count(*) into bad_policies from pg_tables
  where schemaname='public' and tablename in (
    'suivi_profiles','suivi_consents','suivi_measurements','suivi_reminders','suivi_professionals','suivi_shares'
  ) and rowsecurity=false;
  if bad_policies <> 0 then raise exception 'NAXA 126: RLS manquante sur % tables', bad_policies; end if;

  select count(*) into test_accounts from public.feature_flag_test_accounts;
  if test_accounts <> 0 then
    raise notice 'NAXA 126: % compte(s) autorisé(s), chaque compte doit encore accepter le consentement par famille', test_accounts;
  end if;

  if public.is_suivi_test_account('00000000-0000-0000-0000-000000000000'::uuid) then
    raise exception 'NAXA 126: un UUID absent de la liste ne doit jamais être autorisé';
  end if;
end;
$test$;

select true as naxa_126_suivi_connected_security_pass;

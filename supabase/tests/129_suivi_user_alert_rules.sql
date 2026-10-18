-- Test NAXA 129 : alertes seulement sur plages configurées par l’utilisateur.
do $test$
declare rules_rls boolean; alerts_rls boolean; trigger_exists boolean;
begin
 select rowsecurity into rules_rls from pg_tables where schemaname='public' and tablename='suivi_alert_rules';
 select rowsecurity into alerts_rls from pg_tables where schemaname='public' and tablename='suivi_alerts';
 select exists(select 1 from pg_trigger where tgname='evaluate_suivi_user_alert_rules' and not tgisinternal) into trigger_exists;
 if rules_rls is distinct from true or alerts_rls is distinct from true or not trigger_exists then
  raise exception 'NAXA 129: RLS ou déclencheur des alertes absent';
 end if;
 if public.suivi_measurement_family('tension_systolique') <> 'constantes' then raise exception 'NAXA 129: famille de mesure invalide'; end if;
end;
$test$;
select true as naxa_129_user_defined_alerts_pass;

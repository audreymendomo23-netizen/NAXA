-- Test NAXA 128 : retrait du consentement invalide les partages de la famille.
do $test$
declare trigger_exists boolean; policy_def text;
begin
 select exists(select 1 from pg_trigger where tgname='revoke_suivi_shares_on_consent_change' and not tgisinternal) into trigger_exists;
 if not trigger_exists then raise exception 'NAXA 128: déclencheur de révocation des partages absent'; end if;
 select qual || ' ' || with_check into policy_def from pg_policies where schemaname='public' and tablename='suivi_shares' and policyname='suivi_shares_owner_update';
 if policy_def is null or policy_def not like '%active = false%' then raise exception 'NAXA 128: le propriétaire doit pouvoir révoquer un partage même si le professionnel est désactivé'; end if;
 if public.suivi_measurement_family('tension_systolique') <> 'constantes'
    or public.suivi_measurement_family('glycemie') <> 'metabolisme'
    or public.suivi_measurement_family('medicament_pris') <> 'traitements' then
   raise exception 'NAXA 128: mapping des familles incohérent';
 end if;
end;
$test$;
select true as naxa_128_consent_revocation_shares_pass;

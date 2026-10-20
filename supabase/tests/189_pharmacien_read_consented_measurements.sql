-- NAXA 189 — la politique consolidée autorise le professionnel vérifié si le partage et le consentement sont actifs.
do $test$
declare
  v_policy text;
begin
  select coalesce(qual,'') into v_policy from pg_policies
  where schemaname='public' and tablename='suivi_measurements'
    and policyname='suivi_measurements_owner_select' and cmd='SELECT';
  if v_policy is null
     or position('suivi_is_verified_professional' in v_policy)=0
     or position('suivi_has_consent' in v_policy)=0
     or position('suivi_shares' in v_policy)=0
     or position('suivi_is_enabled_user' in v_policy)=0 then
    raise exception 'NAXA 189: politique consolidée de lecture mesures incomplète';
  end if;
  if position('is_suivi_test_account' in v_policy)>0 then
    raise exception 'NAXA 189: accès professionnel dépend encore de l’allowlist de test';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='suivi_shares'
      and policyname='suivi_shares_recipient_select' and cmd='SELECT'
  ) then raise exception 'NAXA 189: policy de lecture du partage destinataire absente'; end if;
  if to_regprocedure('public.suivi_has_consent(uuid,text)') is null
     or to_regprocedure('public.suivi_measurement_family(text)') is null
     or to_regprocedure('public.suivi_is_verified_professional(uuid)') is null then
    raise exception 'NAXA 189: une fonction de contrôle du consentement ou du professionnel manque';
  end if;
end;
$test$;
select true as naxa_189_pharmacien_read_consented_measurements_pass;

-- Test NAXA 142 — intégrité de révocation du consentement des dispositifs.
do $test$
declare
  trigger_exists boolean;
  fn text;
  policy_check text;
begin
  select exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='suivi_consents'
      and t.tgname='suivi_deactivate_devices_on_consent_revocation'
      and not t.tgisinternal
      and t.tgenabled <> 'D'
  ) into trigger_exists;
  if not trigger_exists then raise exception 'NAXA 142: trigger de révocation absent ou désactivé'; end if;

  select pg_get_functiondef('public.suivi_deactivate_devices_on_consent_revocation()'::regprocedure) into fn;
  if fn not like '%old.granted%' or fn not like '%new.granted%' or fn not like '%suivi_user_devices%' or fn not like '%new.family_key%' then
    raise exception 'NAXA 142: la fonction ne désactive pas les dispositifs de la famille concernée lors de la révocation';
  end if;

  select with_check into policy_check from pg_policies
   where schemaname='public' and tablename='suivi_user_devices'
     and policyname='suivi_user_devices_update_self';
  if policy_check is null or policy_check not like '%suivi_has_consent%' or policy_check not like '%active = false%' then
    raise exception 'NAXA 142: la politique doit permettre la désactivation mais exiger le consentement pour l’activation';
  end if;
end;
$test$;

select true as naxa_142_consent_revocation_devices_pass;

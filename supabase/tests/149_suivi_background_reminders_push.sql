-- NAXA 149 — contrat du moteur de rappels et du dispatcher Web Push.
do $test$
declare
  reminders_ok boolean;
  subscriptions_ok boolean;
  notifications_ok boolean;
  verifier_ok boolean;
  verifier_privileges_ok boolean;
  legacy_preview_job_ok boolean;
  dispatcher_ok boolean;
  vault_secret_exists boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='suivi_reminders'
  ) into reminders_ok;
  if not reminders_ok then raise exception 'suivi_reminders table missing'; end if;

  select count(*) = 3 from information_schema.columns
    where table_schema='public' and table_name='naxa_push_subscriptions'
      and column_name in ('endpoint','user_id','subscription')
    into subscriptions_ok;
  if not subscriptions_ok then raise exception 'NAXA Push subscriptions schema incomplete'; end if;

  select count(*) = 4 from information_schema.columns
    where table_schema='public' and table_name='notifications'
      and column_name in ('user_id','type','titre','corps')
    into notifications_ok;
  if not notifications_ok then raise exception 'In-app notification schema incomplete'; end if;

  select to_regprocedure('public.naxa_verify_posology_cron_secret(text)') is not null
    into verifier_ok;
  if not verifier_ok then raise exception 'Dedicated Vault cron verifier missing'; end if;

  select
    has_function_privilege('service_role','public.naxa_verify_posology_cron_secret(text)','EXECUTE')
    and not has_function_privilege('anon','public.naxa_verify_posology_cron_secret(text)','EXECUTE')
    and not has_function_privilege('authenticated','public.naxa_verify_posology_cron_secret(text)','EXECUTE')
    into verifier_privileges_ok;
  if not verifier_privileges_ok then raise exception 'Vault cron verifier grants are too broad or missing'; end if;

  select not exists (
    select 1 from cron.job
    where active
      and command like '%naxa-git-main-naxa3.vercel.app%'
  ) into legacy_preview_job_ok;
  if not legacy_preview_job_ok then
    raise exception 'A scheduled NAXA job still targets the protected Vercel Preview alias';
  end if;

  select exists (
    select 1 from vault.decrypted_secrets
    where name='naxa_posology_cron_secret'
  ) into vault_secret_exists;

  if vault_secret_exists then
    select exists (
      select 1 from cron.job
      where jobname='naxa-posology-web-push-every-five-minutes'
        and active
        and schedule='*/5 * * * *'
        and command like '%https://nnaxa.vercel.app/api/cron/posologie%'
        and command like '%naxa_posology_cron_secret%'
        and command not like '%naxa-git-main-naxa3.vercel.app%'
    ) into dispatcher_ok;
    if not dispatcher_ok then
      raise exception 'Production Push dispatcher missing or not targeting the stable Production endpoint';
    end if;
  else
    select not exists (
      select 1 from cron.job
      where jobname='naxa-posology-web-push-every-five-minutes'
        and active
    ) into dispatcher_ok;
    if not dispatcher_ok then
      raise exception 'Push dispatcher active without its dedicated Vault secret';
    end if;
  end if;
end
$test$;

select 'naxa_149_background_reminders_push_pass' as test, true as passed;

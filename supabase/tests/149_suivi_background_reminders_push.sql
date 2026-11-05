-- NAXA 149 — tests SQL de disponibilité du moteur de rappels et du canal Push.
do $$
declare
  reminders_ok boolean;
  subscriptions_ok boolean;
  notifications_ok boolean;
  cron_ok boolean;
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

  select not exists (
    select 1 from cron.job
    where jobname='naxa-posology-web-push-every-five-minutes'
      and active
  ) into cron_ok;
  if not cron_ok then
    raise exception 'Legacy Push dispatcher still active: it targets a Vercel Preview protected by SSO; Apps Script owns the unified 5-minute dispatch now';
  end if;
end $$;
select 'naxa_149_background_reminders_push_pass' as test, true as passed;
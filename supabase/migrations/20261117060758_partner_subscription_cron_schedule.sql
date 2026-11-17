begin;

create or replace function public.naxa_process_partner_subscription_cycles()
returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_expired integer;
  v_reminders integer;
begin
  v_expired:=public.synchroniser_validite_abonnements_partenaires();
  v_reminders:=public.emettre_rappels_abonnements_partenaires_5j();
  return jsonb_build_object('expired',v_expired,'reminders',v_reminders);
end;
$fn$;

revoke all on function public.naxa_process_partner_subscription_cycles() from public,anon,authenticated;
grant execute on function public.naxa_process_partner_subscription_cycles() to service_role;

do $schedule$
begin
  if exists(select 1 from cron.job where jobname='naxa-partner-subscription-cycle-hourly') then
    perform cron.unschedule(jobid) from cron.job where jobname='naxa-partner-subscription-cycle-hourly';
  end if;
  perform cron.schedule(
    'naxa-partner-subscription-cycle-hourly',
    '20 * * * *',
    'select public.naxa_process_partner_subscription_cycles();'
  );
end;
$schedule$;

commit;

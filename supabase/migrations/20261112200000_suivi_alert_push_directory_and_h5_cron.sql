-- NAXA — files de notification de suivi, annuaire vérifié et contrôle H-5.
begin;

create table if not exists public.suivi_push_outbox (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.suivi_alerts(id) on delete cascade,
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  measurement_type text not null,
  created_at timestamptz not null default now(),
  attempt_count integer not null default 0 check(attempt_count between 0 and 20),
  locked_until timestamptz,
  in_app_created_at timestamptz,
  processed_at timestamptz,
  last_error text,
  unique(alert_id,recipient_user_id)
);
create index if not exists suivi_push_outbox_pending_idx
  on public.suivi_push_outbox(created_at) where processed_at is null;
alter table public.suivi_push_outbox enable row level security;
revoke all on public.suivi_push_outbox from anon,authenticated;
grant select,insert,update,delete on public.suivi_push_outbox to service_role;

create or replace function public.queue_suivi_alert_push()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.suivi_push_outbox(alert_id,patient_user_id,recipient_user_id,measurement_type)
  values(new.id,new.user_id,new.user_id,new.measurement_type)
  on conflict(alert_id,recipient_user_id) do nothing;

  insert into public.suivi_push_outbox(alert_id,patient_user_id,recipient_user_id,measurement_type)
  select new.id,new.user_id,targets.recipient_user_id,new.measurement_type
  from (
    select l.professional_user_id as recipient_user_id
      from public.suivi_care_links l
      where l.patient_user_id=new.user_id and l.active and l.revoked_at is null and l.alerts_access
    union
    select s.recipient_user_id
      from public.suivi_shares s
      where s.owner_user_id=new.user_id and s.measurement_type=new.measurement_type
        and s.active and s.revoked_at is null and s.allow_alerts
  ) targets
  join public.suivi_professionals p on p.user_id=targets.recipient_user_id
  where p.verified=true and p.verification_status='verified'
    and (p.verification_expires_at is null or p.verification_expires_at>now())
  on conflict(alert_id,recipient_user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.queue_suivi_alert_push() from public,anon,authenticated;
drop trigger if exists queue_suivi_alert_push on public.suivi_alerts;
create trigger queue_suivi_alert_push after insert on public.suivi_alerts
for each row execute function public.queue_suivi_alert_push();

create or replace function public.suivi_list_verified_professional_directory()
returns table(user_id uuid,professional_role text,display_name text,specialty text)
language sql stable security definer set search_path='' as $$
  select p.user_id,p.professional_role,p.display_name,p.specialty
  from public.suivi_professionals p
  where p.verified is true
    and p.verification_status='verified'
    and (p.verification_expires_at is null or p.verification_expires_at>now())
    and exists(select 1 from public.feature_flags f where f.flag_key='suivi_connecte' and f.enabled=true)
    and exists(select 1 from public.profiles u where u.id=(select auth.uid()) and u.actif=true)
  order by p.professional_role,p.display_name;
$$;
revoke all on function public.suivi_list_verified_professional_directory() from public,anon;
grant execute on function public.suivi_list_verified_professional_directory() to authenticated;

-- Le dispatcher H-5 exige une précision d'une minute et ne dépend pas de l'application ouverte.
do $dispatch$
declare v_job_id bigint;
begin
  if not exists(select 1 from pg_extension where extname='pg_cron')
    or not exists(select 1 from pg_extension where extname='pg_net')
    or not exists(select 1 from vault.decrypted_secrets where name='naxa_posology_cron_secret') then
    return;
  end if;
  for v_job_id in select jobid from cron.job where jobname='naxa-suivi-freshness-every-minute'
  loop perform cron.unschedule(v_job_id); end loop;
  perform cron.schedule(
    'naxa-suivi-freshness-every-minute','* * * * *',
    'select net.http_get(
      url := ''https://nnaxa.vercel.app/api/cron/suivi'',
      params := ''{}''::jsonb,
      headers := jsonb_build_object(''Authorization'',''Bearer '' || (
        select decrypted_secret from vault.decrypted_secrets where name=''naxa_posology_cron_secret''
      )),
      timeout_milliseconds := 60000
    );'
  );
end;
$dispatch$;

commit;

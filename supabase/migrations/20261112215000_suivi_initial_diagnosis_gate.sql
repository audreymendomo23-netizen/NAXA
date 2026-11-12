-- NAXA — aucun suivi professionnel des données avant le diagnostic initial.
begin;

drop policy if exists suivi_measurements_owner_select on public.suivi_measurements;
create policy suivi_measurements_owner_select on public.suivi_measurements
for select to authenticated using(
  (user_id=(select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())))
  or (
    public.suivi_is_enabled_user((select auth.uid()))
    and public.suivi_is_verified_professional((select auth.uid()))
    and public.suivi_has_consent(user_id,public.suivi_measurement_family(measurement_type))
    and exists(
      select 1 from public.suivi_patient_cases c
      where c.patient_user_id=suivi_measurements.user_id
        and c.professional_user_id=(select auth.uid())
        and c.status='active'
    )
    and exists(
      select 1 from public.suivi_shares s
      where s.owner_user_id=suivi_measurements.user_id
        and s.recipient_user_id=(select auth.uid())
        and s.measurement_type=suivi_measurements.measurement_type
        and s.active=true and s.revoked_at is null
        and (
          (s.allow_history=true and suivi_measurements.measured_at<=s.granted_at)
          or (
            s.allow_realtime=true and s.realtime_from_at is not null
            and suivi_measurements.received_at>=s.realtime_from_at
          )
        )
    )
  )
);

drop policy if exists suivi_alerts_recipient_shared_select on public.suivi_alerts;
create policy suivi_alerts_recipient_shared_select on public.suivi_alerts
for select to authenticated using(
  public.suivi_is_enabled_user((select auth.uid()))
  and public.suivi_is_verified_professional((select auth.uid()))
  and public.suivi_has_consent(user_id,public.suivi_measurement_family(measurement_type))
  and exists(
    select 1 from public.suivi_patient_cases c
    where c.patient_user_id=suivi_alerts.user_id
      and c.professional_user_id=(select auth.uid())
      and c.status='active'
  )
  and exists(
    select 1 from public.suivi_shares s
    where s.owner_user_id=suivi_alerts.user_id
      and s.recipient_user_id=(select auth.uid())
      and s.measurement_type=suivi_alerts.measurement_type
      and s.active=true and s.revoked_at is null and s.allow_alerts=true
  )
  and exists(
    select 1 from public.suivi_measurements m
    where m.id=suivi_alerts.measurement_id
      and m.user_id=suivi_alerts.user_id
      and m.measurement_type=suivi_alerts.measurement_type
  )
);

create or replace function public.queue_suivi_alert_push()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if not public.suivi_has_consent(
    new.user_id,public.suivi_measurement_family(new.measurement_type)
  ) then
    return new;
  end if;

  insert into public.suivi_push_outbox(alert_id,patient_user_id,recipient_user_id,measurement_type)
  values(new.id,new.user_id,new.user_id,new.measurement_type)
  on conflict(alert_id,recipient_user_id) do nothing;

  insert into public.suivi_push_outbox(alert_id,patient_user_id,recipient_user_id,measurement_type)
  select new.id,new.user_id,s.recipient_user_id,new.measurement_type
  from public.suivi_shares s
  where s.owner_user_id=new.user_id
    and s.recipient_user_id<>new.user_id
    and s.measurement_type=new.measurement_type
    and s.active=true and s.revoked_at is null
    and s.allow_alerts=true
    and public.suivi_is_verified_professional(s.recipient_user_id)
    and exists(
      select 1 from public.suivi_patient_cases c
      where c.patient_user_id=new.user_id
        and c.professional_user_id=s.recipient_user_id
        and c.status='active'
    )
  on conflict(alert_id,recipient_user_id) do nothing;

  return new;
end;
$$;
revoke all on function public.queue_suivi_alert_push() from public,anon,authenticated;

commit;

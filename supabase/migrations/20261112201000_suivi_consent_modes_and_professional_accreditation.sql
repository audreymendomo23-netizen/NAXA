-- NAXA — séparation opposable historique / temps réel / alertes et contrôle d'agrément.
begin;

alter table public.suivi_shares
  add column if not exists realtime_from_at timestamptz;
update public.suivi_shares
set realtime_from_at=coalesce(realtime_from_at,granted_at)
where allow_realtime=true;

-- L'agrément expire effectivement : un compte expiré ne peut plus recevoir de nouvelles données.
create or replace function public.suivi_is_verified_professional(p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(exists(
    select 1 from public.suivi_professionals p
    join public.profiles account on account.id=p.user_id
    where p.user_id=p_user_id
      and p.verified=true
      and p.verification_status='verified'
      and (p.verification_expires_at is null or p.verification_expires_at>now())
      and account.actif=true
  ),false);
$$;
revoke all on function public.suivi_is_verified_professional(uuid) from public,anon;
grant execute on function public.suivi_is_verified_professional(uuid) to authenticated,service_role;

-- Un patient peut autoriser l'historique, le flux à partir de l'activation ou les alertes séparément.
drop policy if exists suivi_measurements_owner_select on public.suivi_measurements;
create policy suivi_measurements_owner_select on public.suivi_measurements
for select to authenticated using (
  (user_id=(select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())))
  or (
    public.suivi_is_enabled_user((select auth.uid()))
    and public.suivi_is_verified_professional((select auth.uid()))
    and public.suivi_has_consent(user_id,public.suivi_measurement_family(measurement_type))
    and exists (
      select 1 from public.suivi_shares s
      where s.owner_user_id=suivi_measurements.user_id
        and s.recipient_user_id=(select auth.uid())
        and s.measurement_type=suivi_measurements.measurement_type
        and s.active=true and s.revoked_at is null
        and (
          s.allow_history=true
          or (s.allow_realtime=true and s.realtime_from_at is not null and suivi_measurements.measured_at>=s.realtime_from_at)
        )
    )
  )
);

drop policy if exists suivi_alerts_recipient_shared_select on public.suivi_alerts;
create policy suivi_alerts_recipient_shared_select on public.suivi_alerts
for select to authenticated using (
  public.suivi_is_enabled_user((select auth.uid()))
  and public.suivi_is_verified_professional((select auth.uid()))
  and public.suivi_has_consent(user_id,public.suivi_measurement_family(measurement_type))
  and exists (
    select 1 from public.suivi_shares s
    where s.owner_user_id=suivi_alerts.user_id
      and s.recipient_user_id=(select auth.uid())
      and s.measurement_type=suivi_alerts.measurement_type
      and s.active=true and s.revoked_at is null and s.allow_alerts=true
  )
  and exists (
    select 1 from public.suivi_measurements m
    where m.id=suivi_alerts.measurement_id and m.user_id=suivi_alerts.user_id
      and m.measurement_type=suivi_alerts.measurement_type
  )
);

-- Les notifications pro ne sont placées en file que si le consentement santé existe encore.
create or replace function public.queue_suivi_alert_push()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.suivi_has_consent(new.user_id,public.suivi_measurement_family(new.measurement_type)) then
    return new;
  end if;
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
  where public.suivi_is_verified_professional(targets.recipient_user_id)
  on conflict(alert_id,recipient_user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.queue_suivi_alert_push() from public,anon,authenticated;

commit;

-- NAXA — retrait d'un consentement : fermeture atomique des droits et automatismes liés.
begin;

create or replace function public.suivi_cleanup_revoked_family_consent()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_now timestamptz:=coalesce(new.revoked_at,now());
begin
  if new.granted=true and new.revoked_at is null then
    return new;
  end if;
  if old.granted is not true or old.revoked_at is not null then
    return new;
  end if;

  -- Les partages de mesure de cette famille sont fermés immédiatement.
  update public.suivi_shares s
  set active=false,revoked_at=coalesce(s.revoked_at,v_now)
  where s.owner_user_id=new.user_id
    and s.active=true and s.revoked_at is null
    and public.suivi_measurement_family(s.measurement_type)=new.family_key;

  -- Recalculer chaque relation professionnelle sans effacer le droit clinique
  -- indépendant que le patient a explicitement accordé.
  update public.suivi_care_links l
  set history_access=coalesce((
        select bool_or(s.allow_history) from public.suivi_shares s
        where s.owner_user_id=l.patient_user_id
          and s.recipient_user_id=l.professional_user_id
          and s.active=true and s.revoked_at is null
      ),false),
      realtime_access=coalesce((
        select bool_or(s.allow_realtime) from public.suivi_shares s
        where s.owner_user_id=l.patient_user_id
          and s.recipient_user_id=l.professional_user_id
          and s.active=true and s.revoked_at is null
      ),false),
      alerts_access=coalesce((
        select bool_or(s.allow_alerts) from public.suivi_shares s
        where s.owner_user_id=l.patient_user_id
          and s.recipient_user_id=l.professional_user_id
          and s.active=true and s.revoked_at is null
      ),false),
      active=(
        coalesce((select bool_or(s.allow_history) from public.suivi_shares s
          where s.owner_user_id=l.patient_user_id and s.recipient_user_id=l.professional_user_id
            and s.active=true and s.revoked_at is null),false)
        or coalesce((select bool_or(s.allow_realtime) from public.suivi_shares s
          where s.owner_user_id=l.patient_user_id and s.recipient_user_id=l.professional_user_id
            and s.active=true and s.revoked_at is null),false)
        or coalesce((select bool_or(s.allow_alerts) from public.suivi_shares s
          where s.owner_user_id=l.patient_user_id and s.recipient_user_id=l.professional_user_id
            and s.active=true and s.revoked_at is null),false)
        or l.clinical_notes_access
      ),
      revoked_at=case when (
        coalesce((select bool_or(s.allow_history) from public.suivi_shares s
          where s.owner_user_id=l.patient_user_id and s.recipient_user_id=l.professional_user_id
            and s.active=true and s.revoked_at is null),false)
        or coalesce((select bool_or(s.allow_realtime) from public.suivi_shares s
          where s.owner_user_id=l.patient_user_id and s.recipient_user_id=l.professional_user_id
            and s.active=true and s.revoked_at is null),false)
        or coalesce((select bool_or(s.allow_alerts) from public.suivi_shares s
          where s.owner_user_id=l.patient_user_id and s.recipient_user_id=l.professional_user_id
            and s.active=true and s.revoked_at is null),false)
        or l.clinical_notes_access
      ) then null else v_now end
  where l.patient_user_id=new.user_id;

  update public.suivi_user_devices
  set active=false,auto_reconnect=false,connection_state='disconnected',updated_at=v_now
  where user_id=new.user_id
    and public.suivi_device_family(device_key)=new.family_key;

  update public.suivi_measurement_schedules
  set enabled=false,updated_at=v_now
  where user_id=new.user_id
    and public.suivi_measurement_family(measurement_type)=new.family_key
    and enabled=true;

  update public.suivi_reminders
  set enabled=false,updated_at=v_now
  where user_id=new.user_id
    and public.suivi_measurement_family(measurement_type)=new.family_key
    and enabled=true;

  update public.suivi_alert_rules
  set enabled=false,updated_at=v_now
  where user_id=new.user_id
    and public.suivi_measurement_family(measurement_type)=new.family_key
    and enabled=true;

  return new;
end;
$$;

revoke all on function public.suivi_cleanup_revoked_family_consent() from public,anon,authenticated;
drop trigger if exists suivi_cleanup_revoked_family_consent on public.suivi_consents;
create trigger suivi_cleanup_revoked_family_consent
after update of granted,revoked_at on public.suivi_consents
for each row execute function public.suivi_cleanup_revoked_family_consent();

commit;

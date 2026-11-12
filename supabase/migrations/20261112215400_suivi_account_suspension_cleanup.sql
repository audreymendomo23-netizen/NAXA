-- NAXA — suspension d'un compte : révocation durable des suivis entrants et sortants.
begin;

create or replace function public.suivi_cleanup_suspended_account()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_now timestamptz:=now();
begin
  if old.actif is true and new.actif is false then
    -- Le compte suspendu comme patient perd tous ses partages sortants.
    update public.suivi_shares
      set active=false,revoked_at=coalesce(revoked_at,v_now)
    where owner_user_id=new.id and (active=true or revoked_at is null);

    update public.suivi_care_links
      set active=false,history_access=false,realtime_access=false,
          alerts_access=false,clinical_notes_access=false,revoked_at=v_now
    where patient_user_id=new.id and (active=true or revoked_at is null);

    update public.suivi_user_devices
      set active=false,auto_reconnect=false,connection_state='disconnected',updated_at=v_now
    where user_id=new.id;

    update public.suivi_measurement_schedules
      set enabled=false,updated_at=v_now where user_id=new.id and enabled=true;
    update public.suivi_reminders
      set enabled=false,updated_at=v_now where user_id=new.id and enabled=true;
    update public.suivi_alert_rules
      set enabled=false,updated_at=v_now where user_id=new.id and enabled=true;

    -- Le compte suspendu comme professionnel perd les dossiers et mesures entrants.
    update public.suivi_shares
      set active=false,revoked_at=coalesce(revoked_at,v_now)
    where recipient_user_id=new.id and (active=true or revoked_at is null);

    update public.suivi_care_links
      set active=false,history_access=false,realtime_access=false,
          alerts_access=false,clinical_notes_access=false,revoked_at=v_now
    where professional_user_id=new.id and (active=true or revoked_at is null);
  end if;
  return new;
end;
$$;

revoke all on function public.suivi_cleanup_suspended_account() from public,anon,authenticated;
drop trigger if exists suivi_cleanup_suspended_account on public.profiles;
create trigger suivi_cleanup_suspended_account
after update of actif on public.profiles
for each row
when(old.actif is true and new.actif is false)
execute function public.suivi_cleanup_suspended_account();

commit;

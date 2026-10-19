-- NAXA 142 — retirer immédiatement l'activation des dispositifs quand le consentement associé est révoqué.
-- La révocation reste effective même si la révocation vient d'un autre client que l'interface NAXA.
begin;

create or replace function public.suivi_deactivate_devices_on_consent_revocation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.granted is true and new.granted is false then
    update public.suivi_user_devices
       set active = false,
           updated_at = now()
     where user_id = new.user_id
       and active = true
       and public.suivi_device_family(device_key) = new.family_key;
  end if;
  return new;
end;
$$;

revoke all on function public.suivi_deactivate_devices_on_consent_revocation() from public, anon, authenticated;

drop trigger if exists suivi_deactivate_devices_on_consent_revocation on public.suivi_consents;
create trigger suivi_deactivate_devices_on_consent_revocation
after update of granted on public.suivi_consents
for each row
when (old.granted is true and new.granted is false)
execute function public.suivi_deactivate_devices_on_consent_revocation();

comment on function public.suivi_deactivate_devices_on_consent_revocation() is
  'Désactive les dispositifs personnels de la famille quand le propriétaire retire son consentement.';

commit;

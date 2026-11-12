-- NAXA — visibilité professionnelle des appareils strictement liée au partage des mesures.
begin;

drop policy if exists suivi_user_devices_professional_shared_select on public.suivi_user_devices;
create policy suivi_user_devices_professional_shared_select
on public.suivi_user_devices
for select to authenticated
using(
  public.suivi_is_enabled_user((select auth.uid()))
  and public.suivi_is_verified_professional((select auth.uid()))
  and exists(
    select 1 from public.suivi_patient_cases c
    where c.patient_user_id=suivi_user_devices.user_id
      and c.professional_user_id=(select auth.uid())
      and c.status='active'
  )
  and public.suivi_device_family(device_key) is not null
  and exists(
    select 1 from public.suivi_shares s
    where s.owner_user_id=suivi_user_devices.user_id
      and s.recipient_user_id=(select auth.uid())
      and s.active=true and s.revoked_at is null
      and (s.allow_history=true or s.allow_realtime=true)
      and public.suivi_measurement_family(s.measurement_type)=public.suivi_device_family(suivi_user_devices.device_key)
      and public.suivi_has_consent(s.owner_user_id,public.suivi_device_family(suivi_user_devices.device_key))
  )
);

commit;

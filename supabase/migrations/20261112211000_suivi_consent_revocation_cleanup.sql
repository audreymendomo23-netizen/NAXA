-- NAXA — fermeture cohérente des automatismes lors du retrait d'un consentement.
begin;

-- Les propriétaires doivent pouvoir désactiver une programmation même après avoir
-- retiré le consentement qui autorisait sa création.
drop policy if exists suivi_measurement_schedules_owner_all on public.suivi_measurement_schedules;
create policy suivi_measurement_schedules_owner_all on public.suivi_measurement_schedules
for all to authenticated
using(
  user_id=(select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
)
with check(
  user_id=(select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
  and (
    not enabled
    or (
      public.suivi_has_consent(user_id,public.suivi_measurement_family(measurement_type))
      and (
        device_id is null
        or exists(
          select 1 from public.suivi_user_devices d
          where d.id=device_id and d.user_id=user_id and d.active=true
        )
      )
    )
  )
);

drop policy if exists suivi_reminders_self on public.suivi_reminders;
create policy suivi_reminders_self on public.suivi_reminders
for all to authenticated
using(
  user_id=(select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
)
with check(
  user_id=(select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
  and (
    not enabled
    or public.suivi_has_consent(user_id,public.suivi_measurement_family(measurement_type))
  )
);

drop policy if exists suivi_alert_rules_self on public.suivi_alert_rules;
create policy suivi_alert_rules_self on public.suivi_alert_rules
for all to authenticated
using(
  user_id=(select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
)
with check(
  user_id=(select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
  and (
    not enabled
    or public.suivi_has_consent(user_id,public.suivi_measurement_family(measurement_type))
  )
);

commit;

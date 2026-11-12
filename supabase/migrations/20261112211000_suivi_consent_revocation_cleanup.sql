-- NAXA — fermeture cohérente des automatismes lors du retrait d'un consentement.
begin;

-- Correspondance explicite entre les familles d'appareils et de mesures.
-- Une clé inconnue ne donne aucun droit de partage ni de programmation.
create or replace function public.suivi_device_family(p_device_key text)
returns text
language sql immutable
set search_path=''
as $
  select case p_device_key
    when 'tensiometre' then 'constantes'
    when 'thermometre' then 'constantes'
    when 'oxymetre' then 'constantes'
    when 'glucometre' then 'metabolisme'
    when 'balance' then 'metabolisme'
    when 'capteur_cardiaque_bluetooth' then 'constantes'
    when 'podometre' then 'activite'
    when 'ecg' then 'constantes'
    when 'spirometre' then 'constantes'
    when 'peak_flow' then 'constantes'
    when 'balance_impedance' then 'metabolisme'
    when 'cholesterolometre' then 'metabolisme'
    when 'cetonemetre' then 'metabolisme'
    when 'uricometre' then 'metabolisme'
    when 'montre_connectee' then 'activite'
    when 'bracelet_activite' then 'activite'
    when 'tracker_sommeil' then 'sommeil'
    when 'thermometre_infrarouge' then 'constantes'
    when 'capteur_respiration' then 'constantes'
    when 'pilulier_connecte' then 'traitements'
    when 'bouteille_hydratation' then 'activite'
    else null
  end;
$;
revoke all on function public.suivi_device_family(text) from public,anon;
grant execute on function public.suivi_device_family(text) to authenticated;

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
            and public.suivi_device_family(d.device_key)=public.suivi_measurement_family(measurement_type)
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

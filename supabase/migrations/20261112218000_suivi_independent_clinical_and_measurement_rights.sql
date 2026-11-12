-- NAXA — séparer l'existence du diagnostic initial des droits de lecture du dossier clinique.
begin;

create or replace function public.suivi_has_active_patient_case(p_patient_user_id uuid)
returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(
    p_patient_user_id is not null
    and public.suivi_is_enabled_user((select auth.uid()))
    and public.suivi_is_verified_professional((select auth.uid()))
    and exists(
      select 1
      from public.suivi_patient_cases c
      join public.suivi_care_links l
        on l.patient_user_id=c.patient_user_id
       and l.professional_user_id=c.professional_user_id
      where c.patient_user_id=p_patient_user_id
        and c.professional_user_id=(select auth.uid())
        and c.status='active'
        and l.active=true and l.revoked_at is null
    ),
    false
  );
$$;
revoke all on function public.suivi_has_active_patient_case(uuid) from public,anon;
grant execute on function public.suivi_has_active_patient_case(uuid) to authenticated,service_role;

-- Retourne uniquement l'identifiant du patient, l'état du suivi et le booléen
-- d'autorisation clinique. Aucun diagnostic ni contenu médical n'est exposé ici.
create or replace function public.suivi_list_professional_case_states()
returns table(patient_user_id uuid,case_status text,clinical_notes_access boolean)
language sql stable security definer set search_path='' as $$
  select l.patient_user_id,c.status,l.clinical_notes_access
  from public.suivi_care_links l
  left join public.suivi_patient_cases c
    on c.patient_user_id=l.patient_user_id
   and c.professional_user_id=l.professional_user_id
  where l.professional_user_id=(select auth.uid())
    and l.active=true and l.revoked_at is null
    and public.suivi_is_enabled_user((select auth.uid()))
    and public.suivi_is_verified_professional((select auth.uid()))
    and exists(select 1 from public.profiles patient where patient.id=l.patient_user_id and patient.actif=true)
    and (
      l.clinical_notes_access=true
      or exists(
        select 1 from public.suivi_shares s
        where s.owner_user_id=l.patient_user_id
          and s.recipient_user_id=l.professional_user_id
          and s.active=true and s.revoked_at is null
      )
    );
$$;
revoke all on function public.suivi_list_professional_case_states() from public,anon;
grant execute on function public.suivi_list_professional_case_states() to authenticated;

-- Les droits de mesure/alerte restent indépendants du droit de lire les notes cliniques.
drop policy if exists suivi_measurements_owner_select on public.suivi_measurements;
create policy suivi_measurements_owner_select on public.suivi_measurements
for select to authenticated using(
  (user_id=(select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())))
  or (
    public.suivi_is_enabled_user((select auth.uid()))
    and public.suivi_is_verified_professional((select auth.uid()))
    and public.suivi_has_active_patient_case(user_id)
    and public.suivi_has_consent(user_id,public.suivi_measurement_family(measurement_type))
    and exists(
      select 1 from public.suivi_shares s
      where s.owner_user_id=suivi_measurements.user_id
        and s.recipient_user_id=(select auth.uid())
        and s.measurement_type=suivi_measurements.measurement_type
        and s.active=true and s.revoked_at is null
        and (
          (s.allow_history=true and suivi_measurements.measured_at<=s.granted_at)
          or (s.allow_realtime=true and s.realtime_from_at is not null
            and suivi_measurements.measured_at>=s.realtime_from_at
            and suivi_measurements.received_at>=s.realtime_from_at)
        )
    )
  )
);

drop policy if exists suivi_alerts_recipient_shared_select on public.suivi_alerts;
create policy suivi_alerts_recipient_shared_select on public.suivi_alerts
for select to authenticated using(
  public.suivi_is_enabled_user((select auth.uid()))
  and public.suivi_is_verified_professional((select auth.uid()))
  and public.suivi_has_active_patient_case(user_id)
  and public.suivi_has_consent(user_id,public.suivi_measurement_family(measurement_type))
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

drop policy if exists suivi_user_devices_professional_shared_select on public.suivi_user_devices;
create policy suivi_user_devices_professional_shared_select on public.suivi_user_devices
for select to authenticated using(
  public.suivi_is_enabled_user((select auth.uid()))
  and public.suivi_is_verified_professional((select auth.uid()))
  and public.suivi_has_active_patient_case(user_id)
  and public.suivi_device_family(device_key) is not null
  and public.suivi_has_consent(user_id,public.suivi_device_family(device_key))
  and exists(
    select 1 from public.suivi_shares s
    where s.owner_user_id=suivi_user_devices.user_id
      and s.recipient_user_id=(select auth.uid())
      and s.active=true and s.revoked_at is null
      and (s.allow_history=true or s.allow_realtime=true)
      and public.suivi_measurement_family(s.measurement_type)=public.suivi_device_family(suivi_user_devices.device_key)
  )
);

commit;

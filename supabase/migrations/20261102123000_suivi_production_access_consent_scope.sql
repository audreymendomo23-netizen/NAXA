-- NAXA — production follow-up access, consent-scoped sharing and active-account guards.
-- Consolidates the unapplied legacy changes 194–196 and closes the public consent-oracle gap.
begin;

create or replace function public.suivi_is_enabled_user(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_user_id is not null
    and p_user_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.actif is true
    )
    and exists (
      select 1
      from public.feature_flags f
      where f.flag_key = 'suivi_connecte'
        and f.enabled = true
    ),
    false
  );
$$;
revoke all on function public.suivi_is_enabled_user(uuid) from public, anon;
grant execute on function public.suivi_is_enabled_user(uuid) to authenticated;

-- A consent can be queried by its owner, by a verified professional with a live
-- share in that family, or by the trusted service role. No arbitrary user-id oracle.
create or replace function public.suivi_has_consent(p_user_id uuid, p_family text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_user_id is not null
    and p_family is not null
    and exists (
      select 1
      from public.suivi_consents c
      where c.user_id = p_user_id
        and c.family_key = p_family
        and c.granted = true
        and c.granted_at is not null
        and c.revoked_at is null
    )
    and (
      (
        p_user_id = (select auth.uid())
        and public.suivi_is_enabled_user((select auth.uid()))
      )
      or (select auth.role()) = 'service_role'
      or (
        public.suivi_is_enabled_user((select auth.uid()))
        and public.suivi_is_verified_professional((select auth.uid()))
        and exists (
          select 1
          from public.suivi_shares s
          where s.owner_user_id = p_user_id
            and s.recipient_user_id = (select auth.uid())
            and s.active = true
            and s.revoked_at is null
            and public.suivi_measurement_family(s.measurement_type) = p_family
        )
      )
    ),
    false
  );
$$;

-- Owner-owned resources: active account + global Suivi feature flag.
drop policy if exists suivi_profiles_self on public.suivi_profiles;
create policy suivi_profiles_self on public.suivi_profiles for all to authenticated
using (user_id = (select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())))
with check (user_id = (select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())));

drop policy if exists suivi_consents_self on public.suivi_consents;
create policy suivi_consents_self on public.suivi_consents for all to authenticated
using (user_id = (select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())))
with check (user_id = (select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())));

drop policy if exists suivi_measurements_owner_select on public.suivi_measurements;
create policy suivi_measurements_owner_select on public.suivi_measurements for select to authenticated
using (
  (user_id = (select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())))
  or (
    public.suivi_is_enabled_user((select auth.uid()))
    and public.suivi_is_verified_professional((select auth.uid()))
    and public.suivi_has_consent(user_id, public.suivi_measurement_family(measurement_type))
    and exists (
      select 1 from public.suivi_shares s
      where s.owner_user_id = suivi_measurements.user_id
        and s.recipient_user_id = (select auth.uid())
        and s.measurement_type = suivi_measurements.measurement_type
        and s.active = true and s.revoked_at is null
    )
  )
);

drop policy if exists suivi_measurements_owner_insert on public.suivi_measurements;
create policy suivi_measurements_owner_insert on public.suivi_measurements for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
  and public.suivi_has_consent(user_id, public.suivi_measurement_family(measurement_type))
);

drop policy if exists suivi_measurements_owner_update on public.suivi_measurements;
create policy suivi_measurements_owner_update on public.suivi_measurements for update to authenticated
using (user_id = (select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())))
with check (
  user_id = (select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
  and public.suivi_has_consent(user_id, public.suivi_measurement_family(measurement_type))
);

drop policy if exists suivi_measurements_owner_delete on public.suivi_measurements;
create policy suivi_measurements_owner_delete on public.suivi_measurements for delete to authenticated
using (user_id = (select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())));

-- The previous recipient policy is superseded by the single owner_select policy above.
drop policy if exists suivi_measurements_recipient_shared_select on public.suivi_measurements;

drop policy if exists suivi_reminders_self on public.suivi_reminders;
create policy suivi_reminders_self on public.suivi_reminders for all to authenticated
using (user_id = (select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())))
with check (
  user_id = (select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
  and public.suivi_has_consent(user_id, public.suivi_measurement_family(measurement_type))
);

drop policy if exists suivi_shares_owner_select on public.suivi_shares;
create policy suivi_shares_owner_select on public.suivi_shares for select to authenticated
using (owner_user_id = (select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())));

drop policy if exists suivi_shares_recipient_select on public.suivi_shares;
create policy suivi_shares_recipient_select on public.suivi_shares for select to authenticated
using (
  recipient_user_id = (select auth.uid())
  and active = true and revoked_at is null
  and public.suivi_is_enabled_user((select auth.uid()))
  and public.suivi_is_verified_professional((select auth.uid()))
  and public.suivi_has_consent(owner_user_id, public.suivi_measurement_family(measurement_type))
);

drop policy if exists suivi_shares_owner_insert on public.suivi_shares;
create policy suivi_shares_owner_insert on public.suivi_shares for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
  and public.suivi_is_verified_professional(recipient_user_id)
  and public.suivi_has_consent(owner_user_id, public.suivi_measurement_family(measurement_type))
  and exists (
    select 1 from public.suivi_measurements m
    where m.user_id = owner_user_id
      and m.measurement_type = suivi_shares.measurement_type
  )
);

drop policy if exists suivi_shares_owner_update on public.suivi_shares;
create policy suivi_shares_owner_update on public.suivi_shares for update to authenticated
using (owner_user_id = (select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())))
with check (
  owner_user_id = (select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
  and (
    active = false
    or (
      public.suivi_is_verified_professional(recipient_user_id)
      and public.suivi_has_consent(owner_user_id, public.suivi_measurement_family(measurement_type))
      and exists (
        select 1 from public.suivi_measurements m
        where m.user_id = owner_user_id
          and m.measurement_type = suivi_shares.measurement_type
      )
    )
  )
);

drop policy if exists suivi_professional_self_select on public.suivi_professionals;
create policy suivi_professional_self_select on public.suivi_professionals for select to authenticated
using (
  user_id = (select auth.uid())
  and verified = true
  and public.suivi_is_enabled_user((select auth.uid()))
);

drop policy if exists suivi_alerts_recipient_shared_select on public.suivi_alerts;
create policy suivi_alerts_recipient_shared_select on public.suivi_alerts for select to authenticated
using (
  public.suivi_is_enabled_user((select auth.uid()))
  and public.suivi_is_verified_professional((select auth.uid()))
  and public.suivi_has_consent(user_id, public.suivi_measurement_family(measurement_type))
  and exists (
    select 1 from public.suivi_shares s
    where s.owner_user_id = suivi_alerts.user_id
      and s.recipient_user_id = (select auth.uid())
      and s.measurement_type = suivi_alerts.measurement_type
      and s.active = true and s.revoked_at is null
  )
  and exists (
    select 1 from public.suivi_measurements m
    where m.id = suivi_alerts.measurement_id
      and m.user_id = suivi_alerts.user_id
      and m.measurement_type = suivi_alerts.measurement_type
  )
);

drop policy if exists suivi_alerts_self on public.suivi_alerts;
create policy suivi_alerts_self on public.suivi_alerts for all to authenticated
using (
  user_id = (select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
)
with check (
  user_id = (select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
);

drop policy if exists suivi_alert_rules_self on public.suivi_alert_rules;
create policy suivi_alert_rules_self on public.suivi_alert_rules for all to authenticated
using (
  user_id = (select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
)
with check (
  user_id = (select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
  and public.suivi_has_consent(user_id, public.suivi_measurement_family(measurement_type))
);

drop policy if exists suivi_user_devices_insert_self on public.suivi_user_devices;
create policy suivi_user_devices_insert_self on public.suivi_user_devices for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
  and public.suivi_has_consent(user_id, public.suivi_device_family(device_key))
);

drop policy if exists suivi_user_devices_update_self on public.suivi_user_devices;
create policy suivi_user_devices_update_self on public.suivi_user_devices for update to authenticated
using (
  user_id = (select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
)
with check (
  user_id = (select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
  and (
    active = false
    or public.suivi_has_consent(user_id, public.suivi_device_family(device_key))
  )
);

drop policy if exists suivi_user_devices_select_self on public.suivi_user_devices;
create policy suivi_user_devices_select_self on public.suivi_user_devices for select to authenticated
using (
  user_id = (select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
);

drop policy if exists suivi_user_devices_delete_self on public.suivi_user_devices;
create policy suivi_user_devices_delete_self on public.suivi_user_devices for delete to authenticated
using (
  user_id = (select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
);

comment on function public.suivi_is_enabled_user(uuid) is
  'Autorise un utilisateur courant actif au suivi connecté lorsque le drapeau global est actif. Refuse explicitement toute identité étrangère ou absente.';

comment on function public.suivi_has_consent(uuid,text) is
  'Retourne un consentement uniquement au propriétaire actif, au professionnel vérifié disposant d’un partage actif dans la famille concernée, ou au service_role de confiance.';

commit;

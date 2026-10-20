-- NAXA 194 — accès de production au suivi connecté, sans allowlist de comptes de test.
-- L'activation globale du drapeau suivi_connecte reste le coupe-circuit.
-- Chaque accès professionnel demeure limité au professionnel vérifié, au partage par type,
-- au consentement courant et à l'existence de la mesure correspondante.
begin;

create or replace function public.suivi_is_enabled_user(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
    and p_user_id = (select auth.uid())
    and exists (
      select 1 from public.feature_flags f
      where f.flag_key = 'suivi_connecte' and f.enabled = true
    );
$$;
revoke all on function public.suivi_is_enabled_user(uuid) from public, anon;
grant execute on function public.suivi_is_enabled_user(uuid) to authenticated;

-- Le propriétaire peut gérer son propre dossier uniquement si le suivi est globalement activé.
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
    where m.user_id = owner_user_id and m.measurement_type = suivi_shares.measurement_type
  )
);
drop policy if exists suivi_shares_owner_update on public.suivi_shares;
create policy suivi_shares_owner_update on public.suivi_shares for update to authenticated
using (owner_user_id = (select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())))
with check (
  owner_user_id = (select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
  and (
    active = false or (
      public.suivi_is_verified_professional(recipient_user_id)
      and public.suivi_has_consent(owner_user_id, public.suivi_measurement_family(measurement_type))
      and exists (
        select 1 from public.suivi_measurements m
        where m.user_id = owner_user_id and m.measurement_type = suivi_shares.measurement_type
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

-- Les alertes sont consultables par un professionnel vérifié uniquement si le partage
-- correspondant est toujours actif et le consentement de la famille toujours valide.
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

comment on function public.suivi_is_enabled_user(uuid) is
  'Autorise un compte connecté au suivi lorsque le drapeau global est actif; distinct de l’allowlist de tests. Ne remplace ni consentement ni vérification professionnelle.';
commit;

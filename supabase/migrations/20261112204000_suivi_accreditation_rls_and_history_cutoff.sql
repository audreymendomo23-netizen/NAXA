-- NAXA — resserrer les droits d'accès et rendre le contrôle Admin exécutable.
begin;

drop policy if exists suivi_professionals_owner_select on public.suivi_professionals;
create policy suivi_professionals_owner_select on public.suivi_professionals
for select to authenticated using(
  user_id=(select auth.uid()) and public.suivi_is_enabled_user((select auth.uid()))
);

drop policy if exists suivi_professionals_admin_manage on public.suivi_professionals;
create policy suivi_professionals_admin_manage on public.suivi_professionals
for all to authenticated
using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin' and p.actif=true))
with check(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin' and p.actif=true));

-- L'historique seul s'arrête à l'instant du consentement. Le temps réel ne commence qu'à realtime_from_at.
drop policy if exists suivi_measurements_owner_select on public.suivi_measurements;
create policy suivi_measurements_owner_select on public.suivi_measurements
for select to authenticated using(
  (user_id=(select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())))
  or (
    public.suivi_is_enabled_user((select auth.uid()))
    and public.suivi_is_verified_professional((select auth.uid()))
    and public.suivi_has_consent(user_id,public.suivi_measurement_family(measurement_type))
    and exists(
      select 1 from public.suivi_shares s
      where s.owner_user_id=suivi_measurements.user_id
        and s.recipient_user_id=(select auth.uid())
        and s.measurement_type=suivi_measurements.measurement_type
        and s.active and s.revoked_at is null
        and (
          (s.allow_history and suivi_measurements.measured_at<=s.granted_at)
          or
          (s.allow_realtime and s.realtime_from_at is not null and suivi_measurements.measured_at>=s.realtime_from_at)
        )
    )
  )
);

commit;

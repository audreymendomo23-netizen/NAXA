-- NAXA 196 — retire les dernières politiques de suivi héritées de l'allowlist de test.
begin;

drop policy if exists suivi_measurements_recipient_shared_select on public.suivi_measurements;

drop policy if exists suivi_alerts_self on public.suivi_alerts;
create policy suivi_alerts_self
on public.suivi_alerts for all to authenticated
using (
  user_id = (select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
)
with check (
  user_id = (select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
);

comment on policy suivi_alerts_self on public.suivi_alerts is
  'Le propriétaire gère ses propres alertes uniquement lorsque le suivi connecté est activé globalement; aucune dépendance à l’allowlist de test.';
commit;

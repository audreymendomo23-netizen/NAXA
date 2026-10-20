-- NAXA ERP — alertes de suivi visibles au professionnel uniquement pour les types de mesure partagés.
-- Les alertes sont fondées sur les seuils choisis par le patient, pas sur des seuils médicaux NAXA.
begin;

drop policy if exists suivi_alerts_recipient_shared_select on public.suivi_alerts;
create policy suivi_alerts_recipient_shared_select
on public.suivi_alerts for select to authenticated
using (
  public.is_suivi_test_account(auth.uid())
  and public.suivi_is_verified_professional(auth.uid())
  and public.suivi_has_consent(user_id, public.suivi_measurement_family(measurement_type))
  and exists (
    select 1 from public.suivi_shares s
    where s.owner_user_id=suivi_alerts.user_id
      and s.recipient_user_id=auth.uid()
      and s.measurement_type=suivi_alerts.measurement_type
      and s.active=true
      and s.revoked_at is null
  )
  and exists (
    select 1 from public.suivi_measurements m
    where m.id=suivi_alerts.measurement_id
      and m.user_id=suivi_alerts.user_id
      and m.measurement_type=suivi_alerts.measurement_type
  )
);

comment on policy suivi_alerts_recipient_shared_select on public.suivi_alerts is
  'Le pharmacien vérifié ne lit que les alertes liées à une mesure partagée active, dont le consentement correspondant est toujours valide; aucune écriture ou clôture par le professionnel.';
commit;

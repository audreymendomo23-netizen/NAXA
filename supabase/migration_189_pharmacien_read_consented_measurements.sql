-- NAXA ERP — lecture professionnelle strictement limitée aux mesures explicitement partagées.
-- Le partage seul ne suffisait pas : la politique précédente autorisait la lecture de suivi_shares,
-- mais aucune politique ne permettait au destinataire de lire les mesures effectivement partagées.
begin;

drop policy if exists suivi_measurements_recipient_shared_select on public.suivi_measurements;
create policy suivi_measurements_recipient_shared_select
on public.suivi_measurements for select to authenticated
using (
  public.is_suivi_test_account(auth.uid())
  and public.suivi_is_verified_professional(auth.uid())
  and public.suivi_has_consent(user_id, public.suivi_measurement_family(measurement_type))
  and exists (
    select 1
    from public.suivi_shares s
    where s.owner_user_id = suivi_measurements.user_id
      and s.recipient_user_id = auth.uid()
      and s.measurement_type = suivi_measurements.measurement_type
      and s.active = true
      and s.revoked_at is null
    )
);

comment on policy suivi_measurements_recipient_shared_select on public.suivi_measurements is
  'Le professionnel vérifié ne lit que les types de mesure actifs, explicitement partagés par le propriétaire avec consentement toujours valide et compte en expérimentation autorisée.';
commit;

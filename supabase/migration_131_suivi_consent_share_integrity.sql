-- NAXA 131 — cohérence du consentement avec les partages et intégrité des alertes.
begin;
drop policy if exists suivi_shares_owner_insert on public.suivi_shares;
create policy suivi_shares_owner_insert on public.suivi_shares
for insert to authenticated
with check(
 owner_user_id=auth.uid() and public.is_suivi_test_account(auth.uid())
 and public.suivi_is_verified_professional(recipient_user_id)
 and public.suivi_has_consent(auth.uid(),public.suivi_measurement_family(measurement_type))
 and exists(select 1 from public.suivi_measurements m where m.user_id=auth.uid() and m.measurement_type=suivi_shares.measurement_type)
);
drop policy if exists suivi_shares_owner_update on public.suivi_shares;
create policy suivi_shares_owner_update on public.suivi_shares
for update to authenticated
using(owner_user_id=auth.uid() and public.is_suivi_test_account(auth.uid()))
with check(
 owner_user_id=auth.uid() and public.is_suivi_test_account(auth.uid())
 and (active=false or (
   public.suivi_is_verified_professional(recipient_user_id)
   and public.suivi_has_consent(auth.uid(),public.suivi_measurement_family(measurement_type))
   and exists(select 1 from public.suivi_measurements m where m.user_id=auth.uid() and m.measurement_type=suivi_shares.measurement_type)
 ))
);
revoke insert,delete on public.suivi_alerts from authenticated;
grant select,update on public.suivi_alerts to authenticated;
commit;

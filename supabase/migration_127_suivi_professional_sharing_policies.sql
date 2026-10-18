-- NAXA 127 — partage lisible par le destinataire vérifié et gestion admin des professionnels.
begin;
drop policy if exists suivi_shares_recipient_select on public.suivi_shares;
create policy suivi_shares_recipient_select on public.suivi_shares
for select to authenticated
using (
  recipient_user_id=auth.uid()
  and active=true and revoked_at is null
  and public.is_suivi_test_account(auth.uid())
  and public.suivi_is_verified_professional(auth.uid())
);
drop policy if exists suivi_professionals_admin_manage on public.suivi_professionals;
create policy suivi_professionals_admin_manage on public.suivi_professionals
for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
commit;

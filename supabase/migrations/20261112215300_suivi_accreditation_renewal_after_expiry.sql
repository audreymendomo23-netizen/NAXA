-- NAXA — autoriser le renouvellement d'un agrément expiré sans rouvrir un agrément valide.
begin;
drop policy if exists suivi_professionals_self_update_pending on public.suivi_professionals;
create policy suivi_professionals_self_update_pending on public.suivi_professionals
for update to authenticated
using(
  user_id=(select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
  and (
    verification_status in ('pending','rejected','expired')
    or (verification_status='verified' and verified=true and verification_expires_at is not null and verification_expires_at<=now())
  )
)
with check(
  user_id=(select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
  and verified=false and verification_status='pending'
  and verified_by is null and verified_at is null
);
commit;

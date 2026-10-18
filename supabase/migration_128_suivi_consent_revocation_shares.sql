-- NAXA 128 — révocation effective des partages lors du retrait de consentement.
begin;
create or replace function public.revoke_suivi_shares_on_consent_change()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if new.granted = false then
    update public.suivi_shares s
    set active=false, revoked_at=coalesce(s.revoked_at, now())
    where s.owner_user_id=new.user_id
      and public.suivi_measurement_family(s.measurement_type)=new.family_key
      and s.active=true;
  end if;
  return new;
end;
$$;
revoke all on function public.revoke_suivi_shares_on_consent_change() from public,anon,authenticated;
drop trigger if exists revoke_suivi_shares_on_consent_change on public.suivi_consents;
create trigger revoke_suivi_shares_on_consent_change
after insert or update of granted on public.suivi_consents
for each row execute function public.revoke_suivi_shares_on_consent_change();

drop policy if exists suivi_shares_owner_update on public.suivi_shares;
create policy suivi_shares_owner_update on public.suivi_shares
for update to authenticated
using(owner_user_id=auth.uid() and public.is_suivi_test_account(auth.uid()))
with check(
  owner_user_id=auth.uid() and public.is_suivi_test_account(auth.uid())
  and (active=false or public.suivi_is_verified_professional(recipient_user_id))
);
commit;

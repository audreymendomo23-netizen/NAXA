-- NAXA — renouvellement d'un agrément expiré et exclusion des comptes inactifs.
begin;

drop policy if exists suivi_professionals_self_update_pending on public.suivi_professionals;
create policy suivi_professionals_self_update_pending on public.suivi_professionals
for update to authenticated
using(
  user_id=(select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
  and (
    verification_status in ('pending','rejected','expired')
    or (verified=true and verification_status='verified'
      and verification_expires_at is not null
      and verification_expires_at<=now())
  )
)
with check(
  user_id=(select auth.uid())
  and verified=false
  and verification_status='pending'
  and verified_by is null
  and verified_at is null
);

create or replace function public.suivi_list_verified_professional_directory()
returns table(user_id uuid,professional_role text,display_name text,specialty text)
language sql stable security definer set search_path='' as $$
  select p.user_id,p.professional_role,p.display_name,p.specialty
  from public.suivi_professionals p
  join public.profiles account on account.id=p.user_id and account.actif=true
  where p.verified is true
    and p.verification_status='verified'
    and (p.verification_expires_at is null or p.verification_expires_at>now())
    and exists(
      select 1 from public.feature_flags f
      where f.flag_key='suivi_connecte' and f.enabled=true
    )
    and exists(
      select 1 from public.profiles patient
      where patient.id=(select auth.uid()) and patient.actif=true
    )
  order by p.professional_role,p.display_name;
$$;
revoke all on function public.suivi_list_verified_professional_directory() from public,anon;
grant execute on function public.suivi_list_verified_professional_directory() to authenticated;

commit;

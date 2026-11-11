-- NAXA — align the legacy CircleCI replay with the canonical private Suivi access gate.
-- The user must be the current authenticated user, have an active profile, and
-- the dedicated private feature flag must be enabled. The commercial universe
-- lock is intentionally not consulted.
begin;

create or replace function public.suivi_is_enabled_user(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_user_id is not null
    and p_user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.actif is true
    )
    and exists (
      select 1 from public.feature_flags f
      where f.flag_key = 'suivi_connecte' and f.enabled is true
    ),
    false
  );
$$;

revoke all on function public.suivi_is_enabled_user(uuid) from public, anon;
grant execute on function public.suivi_is_enabled_user(uuid) to authenticated;

comment on function public.suivi_is_enabled_user(uuid) is
  'Suivi privé: utilisateur courant, profil actif et flag suivi_connecte. Indépendant du verrou commercial universe.suivi.';

commit;

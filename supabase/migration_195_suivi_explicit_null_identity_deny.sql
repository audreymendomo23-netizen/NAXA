-- NAXA 195 — normalise les refus d'accès en FALSE plutôt qu'en NULL.
-- Les prédicats RLS refuseraient déjà NULL, mais le résultat explicite facilite l'audit et les tests.
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
      select 1 from public.feature_flags f
      where f.flag_key = 'suivi_connecte' and f.enabled = true
    ),
    false
  );
$$;
revoke all on function public.suivi_is_enabled_user(uuid) from public, anon;
grant execute on function public.suivi_is_enabled_user(uuid) to authenticated;
commit;

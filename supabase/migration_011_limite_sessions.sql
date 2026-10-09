-- NAXA — Limite de 4 sessions simultanées par compte
-- Règle : maximum 4 sessions actives par utilisateur.
-- Aucun appareil/session existant n'est déconnecté automatiquement.
-- La 5e tentative de connexion est refusée.

create or replace function public.naxa_session_count(p_user_id uuid)
returns integer
language sql
security definer
set search_path = pg_catalog, auth
stable
as $$
  select count(*)::integer
  from auth.sessions
  where user_id = p_user_id
    and (not_after is null or not_after > now());
$$;

revoke execute on function public.naxa_session_count(uuid) from public;
revoke execute on function public.naxa_session_count(uuid) from anon;
revoke execute on function public.naxa_session_count(uuid) from authenticated;
grant execute on function public.naxa_session_count(uuid) to service_role;

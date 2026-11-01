-- NAXA 243 — moteur Pilotage privé, accessible uniquement via la façade sécurisée.
-- Le helper conserve ses gardes métier (auth.uid, rôle, privilèges et scope).
-- La façade SECURITY DEFINER l'appelle avec les droits de son propriétaire ;
-- aucun droit EXECUTE direct n'est accordé à authenticated.

revoke all on function private.stats_pilotage_scope(integer) from public, anon, authenticated;

create or replace function public.stats_pilotage_scope(p_jours integer default 7)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.stats_pilotage_scope($1)
$$;

revoke all on function public.stats_pilotage_scope(integer) from public, anon;
grant execute on function public.stats_pilotage_scope(integer) to authenticated;

comment on function public.stats_pilotage_scope(integer) is
  'Façade authentifiée SECURITY DEFINER vers le moteur privé. Le moteur applique les contrôles auth, rôle, privilèges et périmètre ; aucun EXECUTE direct sur le helper privé.';

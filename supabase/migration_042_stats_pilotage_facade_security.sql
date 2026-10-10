-- NAXA 042 — réparation de la façade RPC Pilotage
-- Cause : la façade publique invoker appelle private.stats_pilotage_scope()
-- alors que l'EXECUTE du helper privé est volontairement révoqué aux rôles API.
-- La façade doit donc porter le SECURITY DEFINER, avec search_path vide,
-- puis être exposée uniquement aux utilisateurs authentifiés.
create or replace function public.stats_pilotage_scope(p_jours integer default 7)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.stats_pilotage_scope($1)
$$;

revoke all on function public.stats_pilotage_scope(integer) from public, anon, authenticated;
grant execute on function public.stats_pilotage_scope(integer) to authenticated;

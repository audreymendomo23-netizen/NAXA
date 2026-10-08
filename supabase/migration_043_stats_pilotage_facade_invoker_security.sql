-- NAXA 043 — façade RPC Pilotage invoker
-- Public façade stays invoker; only authenticated users may invoke it.
-- The private helper remains SECURITY DEFINER and is not exposed.
grant execute on function private.stats_pilotage_scope(integer) to authenticated;
create or replace function public.stats_pilotage_scope(p_jours integer default 7)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.stats_pilotage_scope($1)
$$;
revoke execute on function public.stats_pilotage_scope(integer) from public, anon;
grant execute on function public.stats_pilotage_scope(integer) to authenticated;

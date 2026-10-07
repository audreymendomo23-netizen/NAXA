-- NAXA 026 — scope Promoteur canonique
create or replace function public.naxa_scope_allows(p_actor uuid,p_pharmacie uuid,p_scope text default 'PHARMACIE')
returns boolean language sql stable set search_path='' as $$ select private.naxa_scope_allows($1,$2,$3) $$;
revoke all on function public.naxa_scope_allows(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.naxa_scope_allows(uuid,uuid,text) to authenticated;

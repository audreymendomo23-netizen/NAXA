-- NAXA 041 — façade invoker finale
grant execute on function private.naxa_promoteur_valide(uuid) to authenticated;
create or replace function public.naxa_promoteur_valide(p_promoteur uuid default auth.uid())
returns boolean language sql stable security invoker set search_path=''
as $$ select private.naxa_promoteur_valide($1) $$;
revoke execute on function public.naxa_promoteur_valide(uuid) from public,anon;
grant execute on function public.naxa_promoteur_valide(uuid) to authenticated;
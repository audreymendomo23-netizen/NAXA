-- NAXA 040 — fermeture de la façade de validité commerciale
revoke all on function private.naxa_promoteur_valide(uuid) from public,anon,authenticated;
create or replace function public.naxa_promoteur_valide(p_promoteur uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path=''
as $$
begin
  if auth.uid() is null then return false; end if;
  if p_promoteur is distinct from auth.uid() and not public.is_admin() then return false; end if;
  return private.naxa_promoteur_valide(p_promoteur);
end
$$;
revoke all on function public.naxa_promoteur_valide(uuid) from public,anon;
grant execute on function public.naxa_promoteur_valide(uuid) to authenticated;
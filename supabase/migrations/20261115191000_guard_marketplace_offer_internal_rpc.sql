-- Keep the marketplace offer as a narrow public API, not the private implementation.
-- Callers may query validated, current offers through the public wrapper only.
-- The SECURITY DEFINER wrapper runs with its owner privileges; the internal helper
-- is no longer directly executable by API roles.

begin;

create or replace function public.marketplace_offre_stock_disponible(
  p_pharmacie uuid,
  p_produit uuid
)
returns table(prix integer, quantite integer)
language sql
stable
security definer
set search_path = ''
as $function$
  select *
  from private.marketplace_offre_stock_disponible_guarded(p_pharmacie,p_produit);
$function$;

revoke all on function public.marketplace_offre_stock_disponible(uuid,uuid) from public;
grant execute on function public.marketplace_offre_stock_disponible(uuid,uuid)
  to anon, authenticated, service_role;

revoke all on function private.marketplace_offre_stock_disponible_guarded(uuid,uuid)
  from public, anon, authenticated;

commit;

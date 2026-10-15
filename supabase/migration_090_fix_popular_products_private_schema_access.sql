-- Restore public access to the safe wrapper while keeping the implementation private.
-- The underlying private function is SECURITY DEFINER and owns the data access.
begin;

create or replace function public.produits_populaires(
  p_limit integer default 10,
  p_jours integer default 7
)
returns table(produit_id uuid, nom text, dosage text, photo_url text, prix_min integer)
language sql
stable
security definer
set search_path = ''
as $function$
  select *
  from private.produits_populaires(
    least(greatest(coalesce(p_limit, 10), 1), 20),
    greatest(coalesce(p_jours, 7), 1)
  )
$function$;

revoke all on function public.produits_populaires(integer, integer) from public;
grant execute on function public.produits_populaires(integer, integer) to anon, authenticated, service_role;

commit;

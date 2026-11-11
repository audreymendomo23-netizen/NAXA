create or replace function public.get_universe_catalog_for_cart(p_universe_slug text)
returns table(
  product_id uuid, partner_id uuid, pharmacie_id uuid, partner_name text,
  universe_slug text, name text, brand text, category text, description text,
  photo_url text, price_fcfa integer, available_quantity numeric, unit_label text
)
language sql stable security invoker set search_path = ''
as $function$
  select catalogue.product_id, catalogue.partner_id, produit.pharmacie_id,
    catalogue.partner_name, catalogue.universe_slug, catalogue.name,
    catalogue.brand, catalogue.category, catalogue.description,
    catalogue.photo_url, catalogue.price_fcfa, catalogue.available_quantity,
    catalogue.unit_label
  from public.get_universe_catalog(p_universe_slug) as catalogue
  join public.partner_products as produit on produit.id = catalogue.product_id;
$function$;
revoke all on function public.get_universe_catalog_for_cart(text) from public;
grant execute on function public.get_universe_catalog_for_cart(text) to anon, authenticated, service_role;

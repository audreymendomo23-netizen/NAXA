-- Tous les parcours de recherche Marketplace doivent partager le calcul de stock vendable.
do $verify$
declare
  v_single text;
  v_bulk text;
  v_cart text;
begin
  select pg_get_functiondef('public.search_pharmacies(text[],double precision,double precision,double precision)'::regprocedure) into v_single;
  select pg_get_functiondef('public.search_pharmacies_bulk(text[],integer[],double precision,double precision,double precision)'::regprocedure) into v_bulk;
  select pg_get_functiondef('private.search_pharmacies_panier(jsonb,double precision,double precision,double precision)'::regprocedure) into v_cart;

  if position('marketplace_offre_stock_disponible' in v_single)=0 then
    raise exception 'SINGLE_SEARCH_BYPASSES_MARKETPLACE_STOCK_FRESHNESS';
  end if;
  if position('marketplace_offre_stock_disponible' in v_bulk)=0 then
    raise exception 'BULK_SEARCH_BYPASSES_MARKETPLACE_STOCK_FRESHNESS';
  end if;
  if position('marketplace_offre_stock_disponible' in v_cart)=0 then
    raise exception 'CART_SEARCH_BYPASSES_MARKETPLACE_STOCK_FRESHNESS';
  end if;
  if position('offre.quantite > 0' in v_single)=0
     or position('offre.quantite >= b.qte_demandee' in v_bulk)=0
     or position('offre.quantite>=r.qte' in v_cart)=0 then
    raise exception 'SEARCH_QUANTITY_NOT_BOUNDED_BY_SELLABLE_STOCK';
  end if;
end
$verify$;
select 'MARKETPLACE_ALL_SEARCH_PATHS_FRESHNESS PASS' as result;

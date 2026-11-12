-- Les deux read models publics doivent passer par l'offre vendable commune.
do $$
declare
  v_single text;
  v_bulk text;
begin
  select pg_get_functiondef('public.search_pharmacies(text[],double precision,double precision,double precision)'::regprocedure)
    into v_single;
  select pg_get_functiondef('public.search_pharmacies_bulk(text[],integer[],double precision,double precision,double precision)'::regprocedure)
    into v_bulk;

  if position('marketplace_offre_stock_disponible' in v_single)=0 then
    raise exception 'SINGLE_SEARCH_BYPASSES_MARKETPLACE_STOCK_FRESHNESS';
  end if;
  if position('marketplace_offre_stock_disponible' in v_bulk)=0 then
    raise exception 'BULK_SEARCH_BYPASSES_MARKETPLACE_STOCK_FRESHNESS';
  end if;
  if position('offre.quantite > 0' in v_single)=0
     or position('offre.quantite >= b.qte_demandee' in v_bulk)=0 then
    raise exception 'SEARCH_QUANTITY_NOT_BOUNDED_BY_SELLABLE_STOCK';
  end if;
end $$;
select 'MARKETPLACE_SINGLE_AND_BULK_SEARCH_FRESHNESS PASS' as result;

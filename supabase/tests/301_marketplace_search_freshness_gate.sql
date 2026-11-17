-- Contrat actuel de recherche Marketplace.
-- La pharmacie est propriétaire de sa fiche ; aucune validation centrale fiche_validee n'est exigée.
do $$
declare v_public_offer text; v_private_offer text; v_public_single text; v_public_bulk text;
        v_private_single text; v_private_bulk text; v_policy text;
begin
  select pg_get_functiondef('public.marketplace_offre_stock_disponible(uuid,uuid)'::regprocedure) into v_public_offer;
  select pg_get_functiondef('private.marketplace_offre_stock_disponible_guarded(uuid,uuid)'::regprocedure) into v_private_offer;
  select pg_get_functiondef('public.search_pharmacies(text[],double precision,double precision,double precision)'::regprocedure) into v_public_single;
  select pg_get_functiondef('public.search_pharmacies_bulk(text[],integer[],double precision,double precision,double precision)'::regprocedure) into v_public_bulk;
  select pg_get_functiondef('private.search_pharmacies(text[],double precision,double precision,double precision)'::regprocedure) into v_private_single;
  select pg_get_functiondef('private.search_pharmacies_bulk(text[],integer[],double precision,double precision,double precision)'::regprocedure) into v_private_bulk;
  if position('private.marketplace_offre_stock_disponible_guarded' in v_public_offer)=0 then
    raise exception 'PUBLIC_OFFER_WRAPPER_NOT_DELEGATING';
  end if;
  if position('marketplace_stock_last_quantity_update' in v_private_offer)=0
     or position('fiche_validee' in v_private_offer)>0 then
    raise exception 'PRIVATE_OFFER_GUARD_NOT_ALIGNED_TO_PHARMACY_OWNED_PUBLICATION';
  end if;
  if position('private.search_pharmacies(' in v_public_single)=0
     or position('private.search_pharmacies_bulk(' in v_public_bulk)=0 then
    raise exception 'PUBLIC_SEARCH_WRAPPER_NOT_DELEGATING';
  end if;
  if position('private.marketplace_offre_stock_disponible_guarded' in v_private_single)=0
     or position('private.marketplace_offre_stock_disponible_guarded' in v_private_bulk)=0 then
    raise exception 'SEARCH_BYPASSES_PRIVATE_OFFER_GUARD';
  end if;
  if position('fiche_validee' in v_private_single)>0
     or position('fiche_validee' in v_private_bulk)>0 then
    raise exception 'CENTRAL_PRODUCT_VALIDATION_STILL_BLOCKS_PHARMACY_PUBLICATION';
  end if;
  if position('cardinality(p_terms)' in v_private_single)=0
     or position('cardinality(p_terms)' in v_private_bulk)=0
     or position('cardinality(p_quantities)' in v_private_bulk)=0
     or position('q>10' in v_private_bulk)=0 then
    raise exception 'SEARCH_INPUT_BOUNDS_MISSING';
  end if;
  if has_function_privilege('anon','private.marketplace_offre_stock_disponible(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','private.marketplace_offre_stock_disponible(uuid,uuid)','EXECUTE')
     or has_function_privilege('anon','private.marketplace_offre_stock_disponible_guarded(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','private.marketplace_offre_stock_disponible_guarded(uuid,uuid)','EXECUTE') then
    raise exception 'PRIVATE_OFFER_HELPER_MUST_NOT_BE_CLIENT_EXECUTABLE';
  end if;
  if not has_function_privilege('anon','public.marketplace_offre_stock_disponible(uuid,uuid)','EXECUTE')
     or not has_function_privilege('anon','public.search_pharmacies(text[],double precision,double precision,double precision)','EXECUTE')
     or not has_function_privilege('anon','public.search_pharmacies_bulk(text[],integer[],double precision,double precision,double precision)','EXECUTE') then
    raise exception 'PUBLIC_SEARCH_WRAPPERS_UNAVAILABLE';
  end if;
  select qual into v_policy from pg_policies
  where schemaname='public' and tablename='produits' and policyname='produits_public_live_offer_read';
  if v_policy is null or position('marketplace_produit_visible' in v_policy)=0
     or not (select relrowsecurity from pg_class where oid='public.produits'::regclass) then
    raise exception 'PUBLIC_PRODUCT_RLS_POLICY_MISSING';
  end if;
end $$;
begin;
set local role anon;
do $$
declare n integer;
begin
  select count(*) into n from public.marketplace_offre_stock_disponible(
    '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
  if n<>0 then raise exception 'ANON_INVALID_OFFER_IDS_RETURNED_ROWS'; end if;
  select count(*) into n from public.search_pharmacies(array['naxa_no_such_search_term_2026'],6,12.5,100);
  if n<>0 then raise exception 'ANON_INVALID_SINGLE_SEARCH_RETURNED_ROWS'; end if;
  select count(*) into n from public.search_pharmacies_bulk(array['term1','term2'],array[1],6,12.5,100);
  if n<>0 then raise exception 'ANON_BULK_SEARCH_ACCEPTED_MISMATCHED_ARRAYS'; end if;
  select count(*) into n from public.search_pharmacies_bulk(array['term1'],array[11],6,12.5,100);
  if n<>0 then raise exception 'ANON_BULK_SEARCH_ACCEPTED_QUANTITY_OVER_10'; end if;
end $$;
rollback;
select 'MARKETPLACE_PUBLIC_SEARCH_GUARDS_CURRENT_CONTRACT PASS' as result;

-- Les parcours Marketplace utilisent des wrappers publics INVOKER et des moteurs privés bornés.
do $verify$
declare
  v_public_offer text;
  v_private_offer text;
  v_public_single text;
  v_public_bulk text;
  v_private_single text;
  v_private_bulk text;
begin
  select pg_get_functiondef('public.marketplace_offre_stock_disponible(uuid,uuid)'::regprocedure) into v_public_offer;
  select pg_get_functiondef('private.marketplace_offre_stock_disponible_guarded(uuid,uuid)'::regprocedure) into v_private_offer;
  select pg_get_functiondef('public.search_pharmacies(text[],double precision,double precision,double precision)'::regprocedure) into v_public_single;
  select pg_get_functiondef('public.search_pharmacies_bulk(text[],integer[],double precision,double precision,double precision)'::regprocedure) into v_public_bulk;
  select pg_get_functiondef('private.search_pharmacies(text[],double precision,double precision,double precision)'::regprocedure) into v_private_single;
  select pg_get_functiondef('private.search_pharmacies_bulk(text[],integer[],double precision,double precision,double precision)'::regprocedure) into v_private_bulk;

  if v_public_offer ilike '%SECURITY DEFINER%'
     or v_public_offer not ilike '%private.marketplace_offre_stock_disponible_guarded%' then
    raise exception 'PUBLIC_STOCK_WRAPPER_MUST_BE_INVOKER_AND_DELEGATE_TO_PRIVATE_GUARD';
  end if;
  if v_private_offer not ilike '%fiche_validee is true%'
     or v_private_offer not ilike '%marketplace_stock_last_quantity_update%'
     or v_private_offer not ilike '%48 hours%'
     or v_private_offer not ilike '%coalesce(l.bloque%'
     or v_private_offer not ilike '%date_peremption%' then
    raise exception 'PRIVATE_STOCK_GUARD_MUST_VALIDATE_PRODUCT_FRESHNESS_AND_LOTS';
  end if;

  if v_public_single ilike '%SECURITY DEFINER%'
     or v_public_single not ilike '%private.search_pharmacies%' then
    raise exception 'SINGLE_SEARCH_WRAPPER_MUST_BE_INVOKER';
  end if;
  if v_public_bulk ilike '%SECURITY DEFINER%'
     or v_public_bulk not ilike '%private.search_pharmacies_bulk%' then
    raise exception 'BULK_SEARCH_WRAPPER_MUST_BE_INVOKER';
  end if;

  if v_private_single not ilike '%private.marketplace_offre_stock_disponible_guarded%'
     or v_private_bulk not ilike '%private.marketplace_offre_stock_disponible_guarded%' then
    raise exception 'SINGLE_OR_BULK_SEARCH_BYPASSES_PRIVATE_STOCK_GUARD';
  end if;
  if v_private_single not ilike '%fiche_validee is true%'
     or v_private_bulk not ilike '%fiche_validee is true%' then
    raise exception 'SINGLE_OR_BULK_SEARCH_CAN_PUBLISH_UNVALIDATED_PRODUCTS';
  end if;
  if v_private_single not ilike '%cardinality(p_terms)%'
     or v_private_bulk not ilike '%cardinality(p_terms)%'
     or v_private_bulk not ilike '%cardinality(p_quantities)%'
     or v_private_bulk not ilike '%q>10%' then
    raise exception 'SEARCH_INPUT_BOUNDS_MISSING';
  end if;

  if has_function_privilege('anon','private.marketplace_offre_stock_disponible(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','private.marketplace_offre_stock_disponible(uuid,uuid)','EXECUTE') then
    raise exception 'LEGACY_PRIVATE_STOCK_HELPER_MUST_NOT_BE_CLIENT_EXECUTABLE';
  end if;
  if not has_function_privilege('anon','private.marketplace_offre_stock_disponible_guarded(uuid,uuid)','EXECUTE')
     or not has_function_privilege('anon','private.search_pharmacies(text[],double precision,double precision,double precision)','EXECUTE')
     or not has_function_privilege('anon','private.search_pharmacies_bulk(text[],integer[],double precision,double precision,double precision)','EXECUTE') then
    raise exception 'PRIVATE_INTERNAL_EXECUTE_ALLOWLIST_INCOMPLETE';
  end if;
  if not has_function_privilege('anon','public.marketplace_offre_stock_disponible(uuid,uuid)','EXECUTE')
     or not has_function_privilege('anon','public.search_pharmacies(text[],double precision,double precision,double precision)','EXECUTE')
     or not has_function_privilege('anon','public.search_pharmacies_bulk(text[],integer[],double precision,double precision,double precision)','EXECUTE') then
    raise exception 'PUBLIC_SEARCH_WRAPPERS_MUST_REMAIN_AVAILABLE';
  end if;

  if exists (
    select 1
    from public.produits p
    join public.stocks s on s.produit_id=p.id and s.quantite>0
    cross join lateral public.marketplace_offre_stock_disponible(s.pharmacie_id,p.id) o
    where p.fiche_validee is false and o.quantite>0
  ) then
    raise exception 'UNVALIDATED_PRODUCT_OFFER_ESCAPED_PUBLIC_STOCK_GUARD';
  end if;
end
$verify$;

begin;
set local role anon;
do $anon$
declare v_count integer;
begin
  select count(*) into v_count
  from public.marketplace_offre_stock_disponible(
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid
  );
  if v_count<>0 then raise exception 'ANON_STOCK_LOOKUP_INVALID_IDS_NOT_EMPTY'; end if;

  select count(*) into v_count
  from public.search_pharmacies(array['naxa_no_such_search_term_2026'],6,12.5,100);
  if v_count<>0 then raise exception 'ANON_SINGLE_SEARCH_INVALID_TERM_NOT_EMPTY'; end if;

  select count(*) into v_count
  from public.search_pharmacies_bulk(array['term1','term2'],array[1],6,12.5,100);
  if v_count<>0 then raise exception 'ANON_BULK_SEARCH_ACCEPTED_MISMATCHED_ARRAYS'; end if;

  select count(*) into v_count
  from public.search_pharmacies_bulk(array['term1'],array[11],6,12.5,100);
  if v_count<>0 then raise exception 'ANON_BULK_SEARCH_ACCEPTED_QUANTITY_OVER_10'; end if;
end
$anon$;
rollback;

select 'MARKETPLACE_PUBLIC_SEARCH_GUARDS PASS' as result;

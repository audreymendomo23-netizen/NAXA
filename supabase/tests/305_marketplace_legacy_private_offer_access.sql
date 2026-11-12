do $verify$
begin
  if has_function_privilege('anon','private.marketplace_offre_stock_disponible(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','private.marketplace_offre_stock_disponible(uuid,uuid)','EXECUTE') then
    raise exception 'LEGACY_PRIVATE_MARKETPLACE_OFFER_MUST_NOT_BE_CALLABLE_BY_CLIENT_ROLES';
  end if;
  if not has_function_privilege('anon','public.marketplace_offre_stock_disponible(uuid,uuid)','EXECUTE') then
    raise exception 'PUBLIC_FRESHNESS_GATED_MARKETPLACE_OFFER_MUST_REMAIN_AVAILABLE';
  end if;
end
$verify$;
select 'MARKETPLACE_LEGACY_PRIVATE_OFFER_REVOKED PASS' as result;

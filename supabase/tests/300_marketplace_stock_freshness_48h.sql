-- Contrat de régression : fraîcheur Marketplace et réservation.
-- Test en lecture seule des définitions déployables ; aucun jeu de données n'est créé.
do $$
declare
  v_offer text;
  v_reserve text;
begin
  select pg_get_functiondef('public.marketplace_offre_stock_disponible(uuid,uuid)'::regprocedure)
    into v_offer;
  select pg_get_functiondef('private.reserve_stock(uuid,jsonb)'::regprocedure)
    into v_reserve;

  if position('marketplace_stock_last_quantity_update' in v_offer) = 0
     or position('interval ''48 hours''' in v_offer) = 0
     or position('now() - interval ''48 hours''' in v_offer) = 0
     or position('ph.est_demo = false' in v_offer) = 0
     or position('ph.archivee_le is null' in v_offer) = 0 then
    raise exception 'MARKETPLACE_STOCK_FRESHNESS_FILTER_MISSING';
  end if;

  if position('stock_manager_movement_journal' in pg_get_functiondef('private.marketplace_stock_last_quantity_update(uuid,uuid)'::regprocedure)) = 0
     or position('event_type in (''creation'', ''quantite'', ''suppression'')' in pg_get_functiondef('private.marketplace_stock_last_quantity_update(uuid,uuid)'::regprocedure)) = 0
     or position('s.updated_at' in pg_get_functiondef('private.marketplace_stock_last_quantity_update(uuid,uuid)'::regprocedure)) = 0 then
    raise exception 'MARKETPLACE_FRESHNESS_MUST_USE_PHYSICAL_QUANTITY_JOURNAL';
  end if;

  if position('marketplace_stock_last_quantity_update' in v_reserve) = 0
     or position('marketplace_offre_stock_disponible' in v_reserve) = 0
     or position('now() - interval ''48 hours''' in v_reserve) = 0
     or position('for update' in v_reserve) = 0 then
    raise exception 'RESERVATION_STOCK_FRESHNESS_GUARD_MISSING';
  end if;

  if position('v_total := v_total + v_prix * v_q' in v_reserve) = 0
     or position('insert into public.reservation_items' in v_reserve) = 0 then
    raise exception 'SERVER_SIDE_QUANTITY_PRICE_SNAPSHOT_MISSING';
  end if;

  if has_function_privilege('anon', 'private.reserve_stock(uuid,jsonb)', 'EXECUTE') then
    raise exception 'PRIVATE_RESERVATION_MUST_NOT_BE_ANON_EXECUTABLE';
  end if;
end $$;

select 'MARKETPLACE_STOCK_FRESHNESS_AND_RESERVATION_GUARD PASS' as result;

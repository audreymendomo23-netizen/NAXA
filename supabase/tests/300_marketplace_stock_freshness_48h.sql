-- Contrat actuel de fraîcheur Marketplace et réservation.
-- Lecture des définitions déployées ; aucun jeu de données n'est créé.
do $$
declare v_offer text; v_reserve text; v_fresh text;
begin
  select pg_get_functiondef('private.marketplace_offre_stock_disponible_guarded(uuid,uuid)'::regprocedure) into v_offer;
  select pg_get_functiondef('private.reserve_stock(uuid,jsonb)'::regprocedure) into v_reserve;
  select pg_get_functiondef('private.marketplace_stock_last_quantity_update(uuid,uuid)'::regprocedure) into v_fresh;
  if position('marketplace_stock_last_quantity_update' in v_offer)=0
     or position('interval ''48 hours''' in v_offer)=0
     or position('ph.est_demo is false' in lower(v_offer))=0
     or position('ph.archivee_le is null' in lower(v_offer))=0 then
    raise exception 'MARKETPLACE_STOCK_FRESHNESS_FILTER_MISSING';
  end if;
  if position('stock_manager_movement_journal' in v_fresh)=0
     or position('event_type in (''creation'', ''quantite'', ''suppression'')' in v_fresh)=0
     or position('s.updated_at' in v_fresh)=0 then
    raise exception 'MARKETPLACE_FRESHNESS_JOURNAL_CONTRACT_MISSING';
  end if;
  if position('coalesce(l.bloque,false)=false' in v_offer)=0
     or position('date_peremption' in v_offer)=0
     or position('reservation_items' in v_offer)=0 then
    raise exception 'MARKETPLACE_LOT_OR_HOLD_FILTER_MISSING';
  end if;
  if position('marketplace_stock_last_quantity_update' in v_reserve)=0
     or position('marketplace_offre_stock_disponible' in v_reserve)=0
     or position('interval ''48 hours''' in v_reserve)=0
     or position('for update' in v_reserve)=0 then
    raise exception 'RESERVATION_STOCK_FRESHNESS_GUARD_MISSING';
  end if;
  if position('v_total := v_total + v_prix * v_q' in v_reserve)=0
     or position('insert into public.reservation_items' in v_reserve)=0 then
    raise exception 'SERVER_SIDE_QUANTITY_PRICE_SNAPSHOT_MISSING';
  end if;
  if has_function_privilege('anon','private.reserve_stock(uuid,jsonb)','EXECUTE') then
    raise exception 'PRIVATE_RESERVATION_MUST_NOT_BE_ANON_EXECUTABLE';
  end if;
end $$;
select 'MARKETPLACE_STOCK_FRESHNESS_AND_RESERVATION_GUARD PASS' as result;

-- NAXA Replay regression: 25 FK index covers for Caisse, POS, Stock and Supply.
BEGIN;
SET LOCAL enable_seqscan = off;
DO $core_fk_batch4$
DECLARE v record; v_line record; v_plan text; v_count integer := 0;
BEGIN
 FOR v IN SELECT * FROM (VALUES
      ('caisses_sessions','caisses_sessions_cloture_par_fkey','cloture_par','idx_caisses_sessions_cloture_par'),
      ('caisses_sessions','caisses_sessions_ouvert_par_fkey','ouvert_par','idx_caisses_sessions_ouvert_par'),
      ('reservation_item_lots','reservation_item_lots_produit_id_fkey','produit_id','idx_reservation_item_lots_produit_id'),
      ('vente_paiements','vente_paiements_created_by_fkey','created_by','idx_vente_paiements_created_by'),
      ('fournisseurs','fournisseurs_created_by_fkey','created_by','idx_fournisseurs_created_by'),
      ('stock_service_sessions','stock_service_sessions_gestionnaire_id_fkey','gestionnaire_id','idx_stock_service_sessions_gestionnaire_id'),
      ('commandes_fournisseurs','commandes_fournisseurs_created_by_fkey','created_by','idx_commandes_fournisseurs_created_by'),
      ('commandes_fournisseurs','commandes_fournisseurs_fournisseur_id_fkey','fournisseur_id','idx_commandes_fournisseurs_fournisseur_id'),
      ('inventaire_lignes','inventaire_lignes_lot_id_fkey','lot_id','idx_inventaire_lignes_lot_id'),
      ('inventaire_lignes','inventaire_lignes_produit_id_fkey','produit_id','idx_inventaire_lignes_produit_id'),
      ('inventaires','inventaires_closed_by_fkey','closed_by','idx_inventaires_closed_by'),
      ('inventaires','inventaires_created_by_fkey','created_by','idx_inventaires_created_by'),
      ('commandes_fournisseurs_lignes','commandes_fournisseurs_lignes_produit_id_fkey','produit_id','idx_commandes_fournisseurs_lignes_produit_id'),
      ('receptions_fournisseurs','receptions_fournisseurs_recu_par_fkey','recu_par','idx_receptions_fournisseurs_recu_par'),
      ('inventaire_ajustements','inventaire_ajustements_acteur_id_fkey','acteur_id','idx_inventaire_ajustements_acteur_id'),
      ('inventaire_ajustements','inventaire_ajustements_ligne_id_fkey','ligne_id','idx_inventaire_ajustements_ligne_id'),
      ('inventaire_ajustements','inventaire_ajustements_lot_id_fkey','lot_id','idx_inventaire_ajustements_lot_id'),
      ('inventaire_ajustements','inventaire_ajustements_produit_id_fkey','produit_id','idx_inventaire_ajustements_produit_id'),
      ('receptions_fournisseurs_lignes','receptions_fournisseurs_lignes_commande_ligne_id_fkey','commande_ligne_id','idx_receptions_fournisseurs_lignes_commande_ligne_id'),
      ('stock_manager_transfers','stock_manager_transfers_acteur_id_fkey','acteur_id','idx_stock_manager_transfers_acteur_id'),
      ('stock_manager_transfers','stock_manager_transfers_destination_lot_id_fkey','destination_lot_id','idx_stock_manager_transfers_destination_lot_id'),
      ('stock_manager_transfers','stock_manager_transfers_produit_id_fkey','produit_id','idx_stock_manager_transfers_produit_id'),
      ('stock_manager_transfers','stock_manager_transfers_source_lot_id_fkey','source_lot_id','idx_stock_manager_transfers_source_lot_id'),
      ('stock_service_inventory_counts','stock_service_inventory_counts_counted_by_fkey','counted_by','idx_stock_service_inventory_counts_counted_by'),
      ('stock_service_inventory_counts','stock_service_inventory_counts_produit_id_fkey','produit_id','idx_stock_service_inventory_counts_produit_id')
 ) AS x(table_name,constraint_name,column_name,index_name)
 LOOP
  IF NOT EXISTS (
   SELECT 1 FROM pg_constraint c
   WHERE c.conrelid=to_regclass(format('public.%I',v.table_name))
     AND c.conname=v.constraint_name AND c.contype='f'
     AND (SELECT a.attname FROM unnest(c.conkey) WITH ORDINALITY k(attnum,ord)
          JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum
          WHERE k.ord=1)=v.column_name
  ) THEN RAISE EXCEPTION 'Expected FK missing/mismatched: %.%',v.table_name,v.constraint_name; END IF;
  IF NOT EXISTS (
   SELECT 1 FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid
   JOIN pg_class ix ON ix.oid=i.indexrelid
   JOIN unnest(i.indkey) WITH ORDINALITY k(attnum,ord) ON k.ord=1
   JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
   WHERE t.oid=to_regclass(format('public.%I',v.table_name))
     AND ix.relname=v.index_name AND i.indisvalid AND i.indisready
     AND i.indpred IS NULL AND i.indnkeyatts>=1 AND a.attname=v.column_name
  ) THEN RAISE EXCEPTION 'Expected valid leading-column index missing: %.%',v.table_name,v.index_name; END IF;
  v_plan := '';
  FOR v_line IN EXECUTE format('EXPLAIN (ANALYZE, COSTS OFF) SELECT %I FROM public.%I WHERE %I IS NOT NULL',v.column_name,v.table_name,v.column_name,'00000000-0000-0000-0000-000000000000')
  LOOP v_plan := v_plan || coalesce(v_line."QUERY PLAN",'') || E'\n'; END LOOP;
  IF position(v.index_name in v_plan)=0 THEN RAISE EXCEPTION 'Planner did not choose %.%: %',v.table_name,v.index_name,v_plan; END IF;
  v_count := v_count + 1;
 END LOOP;
 IF v_count <> 25 THEN RAISE EXCEPTION 'Expected 25 assertions, got %',v_count; END IF;
END;
$core_fk_batch4$;
ROLLBACK;
SELECT '322_core_fk_indexes_batch4_PASS' AS result,25 AS structural_assertions,25 AS planner_assertions;

-- NAXA Replay regression: 22 priority FK indexes are structurally valid
-- and selected by PostgreSQL in a plan check. The transaction is rolled back.
BEGIN;
SET LOCAL enable_seqscan = off;

DO $naxa_fk_index_structure_test$
DECLARE
  v record;
  v_count integer := 0;
BEGIN
  FOR v IN
    SELECT * FROM (VALUES
      ('reservations','reservations_delivery_quote_id_fkey','delivery_quote_id','idx_reservations_delivery_quote_id'),
      ('naxa_profile_active_roles','naxa_profile_active_roles_role_code_fkey','role_code','idx_naxa_profile_active_roles_role_code'),
      ('naxa_profile_active_roles','naxa_profile_active_roles_pharmacie_id_fkey','pharmacie_id','idx_naxa_profile_active_roles_pharmacie_id'),
      ('naxa_professional_assignments','naxa_professional_assignments_accorde_par_fkey','accorde_par','idx_naxa_professional_assignments_accorde_par'),
      ('naxa_professional_assignments','naxa_professional_assignments_role_code_fkey','role_code','idx_naxa_professional_assignments_role_code'),
      ('naxa_professional_assignments','naxa_professional_assignments_revoque_par_fkey','revoque_par','idx_naxa_professional_assignments_revoque_par'),
      ('ventes','ventes_client_id_fkey','client_id','idx_ventes_client_id'),
      ('ventes','ventes_created_by_fkey','created_by','idx_ventes_created_by'),
      ('client_credit_requests','client_credit_requests_decided_by_fkey','decided_by','idx_client_credit_requests_decided_by'),
      ('client_credit_requests','client_credit_requests_credit_id_fkey','credit_id','idx_client_credit_requests_credit_id'),
      ('client_credit_requests','client_credit_requests_vente_id_fkey','vente_id','idx_client_credit_requests_vente_id'),
      ('client_credit_requests','client_credit_requests_requested_by_fkey','requested_by','idx_client_credit_requests_requested_by'),
      ('vente_lignes','vente_lignes_vente_id_fkey','vente_id','idx_vente_lignes_vente_id'),
      ('alertes','alertes_pharmacie_id_fkey','pharmacie_id','idx_alertes_pharmacie_id'),
      ('evenements','evenements_pharmacie_id_fkey','pharmacie_id','idx_evenements_pharmacie_id'),
      ('evenements','evenements_produit_id_fkey','produit_id','idx_evenements_produit_id'),
      ('rappels_lots','rappels_lots_compte_par_fkey','compte_par','idx_rappels_lots_compte_par'),
      ('rappels_lots','rappels_lots_created_by_fkey','created_by','idx_rappels_lots_created_by'),
      ('rappels_lots','rappels_lots_leve_par_fkey','leve_par','idx_rappels_lots_leve_par'),
      ('rappels_lots','rappels_lots_lot_id_fkey','lot_id','idx_rappels_lots_lot_id'),
      ('stock_manager_movement_journal','stock_manager_movement_journal_acteur_id_fkey','acteur_id','idx_stock_manager_movement_journal_acteur_id'),
      ('stock_manager_movement_journal','stock_manager_movement_journal_produit_id_fkey','produit_id','idx_stock_manager_movement_journal_produit_id')
    ) AS x(table_name,constraint_name,column_name,index_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = to_regclass(format('public.%I',v.table_name))
        AND c.conname = v.constraint_name
        AND c.contype = 'f'
        AND (SELECT a.attname
             FROM unnest(c.conkey) WITH ORDINALITY k(attnum,ord)
             JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum
             WHERE k.ord=1) = v.column_name
    ) THEN
      RAISE EXCEPTION 'Expected FK missing/mismatched: %.%',v.table_name,v.constraint_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_index i
      JOIN pg_class t ON t.oid=i.indrelid
      JOIN pg_class ix ON ix.oid=i.indexrelid
      JOIN unnest(i.indkey) WITH ORDINALITY k(attnum,ord) ON k.ord=1
      JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
      WHERE t.oid=to_regclass(format('public.%I',v.table_name))
        AND ix.relname=v.index_name
        AND i.indisvalid AND i.indisready
        AND i.indpred IS NULL
        AND i.indnkeyatts >= 1
        AND a.attname=v.column_name
    ) THEN
      RAISE EXCEPTION 'Expected valid non-partial leading-column index missing: %.%',v.table_name,v.index_name;
    END IF;
    v_count := v_count + 1;
  END LOOP;

  IF v_count <> 22 THEN
    RAISE EXCEPTION 'Expected 22 FK index assertions, got %',v_count;
  END IF;
END;
$naxa_fk_index_structure_test$;

DO $naxa_fk_index_plan_test$
DECLARE
  v record;
  v_line record;
  v_plan text;
  v_count integer := 0;
BEGIN
  FOR v IN
    SELECT * FROM (VALUES
      ('reservations','delivery_quote_id','idx_reservations_delivery_quote_id'),
      ('naxa_profile_active_roles','role_code','idx_naxa_profile_active_roles_role_code'),
      ('naxa_profile_active_roles','pharmacie_id','idx_naxa_profile_active_roles_pharmacie_id'),
      ('naxa_professional_assignments','accorde_par','idx_naxa_professional_assignments_accorde_par'),
      ('naxa_professional_assignments','role_code','idx_naxa_professional_assignments_role_code'),
      ('naxa_professional_assignments','revoque_par','idx_naxa_professional_assignments_revoque_par'),
      ('ventes','client_id','idx_ventes_client_id'),
      ('ventes','created_by','idx_ventes_created_by'),
      ('client_credit_requests','decided_by','idx_client_credit_requests_decided_by'),
      ('client_credit_requests','credit_id','idx_client_credit_requests_credit_id'),
      ('client_credit_requests','vente_id','idx_client_credit_requests_vente_id'),
      ('client_credit_requests','requested_by','idx_client_credit_requests_requested_by'),
      ('vente_lignes','vente_id','idx_vente_lignes_vente_id'),
      ('alertes','pharmacie_id','idx_alertes_pharmacie_id'),
      ('evenements','pharmacie_id','idx_evenements_pharmacie_id'),
      ('evenements','produit_id','idx_evenements_produit_id'),
      ('rappels_lots','compte_par','idx_rappels_lots_compte_par'),
      ('rappels_lots','created_by','idx_rappels_lots_created_by'),
      ('rappels_lots','leve_par','idx_rappels_lots_leve_par'),
      ('rappels_lots','lot_id','idx_rappels_lots_lot_id'),
      ('stock_manager_movement_journal','acteur_id','idx_stock_manager_movement_journal_acteur_id'),
      ('stock_manager_movement_journal','produit_id','idx_stock_manager_movement_journal_produit_id')
    ) AS x(table_name,column_name,index_name)
  LOOP
    v_plan := '';
    FOR v_line IN EXECUTE format(
      'EXPLAIN (ANALYZE, COSTS OFF) SELECT %I FROM public.%I WHERE %I IS NOT NULL',
      v.column_name,v.table_name,v.column_name
    )
    LOOP
      v_plan := v_plan || coalesce(v_line."QUERY PLAN",'') || E'\n';
    END LOOP;

    IF position(v.index_name in v_plan) = 0 THEN
      RAISE EXCEPTION 'Planner did not choose %.%: %',v.table_name,v.index_name,v_plan;
    END IF;
    v_count := v_count + 1;
  END LOOP;

  IF v_count <> 22 THEN
    RAISE EXCEPTION 'Expected 22 FK index plans, got %',v_count;
  END IF;
END;
$naxa_fk_index_plan_test$;

ROLLBACK;
SELECT '320_naxa_core_fk_indexes_batch2_PASS' AS result,
       22 AS structural_assertions,
       22 AS planner_assertions;

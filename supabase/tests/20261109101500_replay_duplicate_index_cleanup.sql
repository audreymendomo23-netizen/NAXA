-- NAXA — regression test for duplicate-index cleanup.
BEGIN;

DO $test$
DECLARE
  v_removed text[] := ARRAY[
    'abonnements_pharmacie_unique_base',
    'commandes_fournisseurs_lignes_order_idx',
    'reservation_events_pharmacie_idx',
    'stocks_lots_id_uq'
  ];
  v_kept text[] := ARRAY[
    'abonnements_pharmacie_unique',
    'commandes_fournisseurs_lignes_commande_idx',
    'reservation_events_pharmacy_idx',
    'stocks_lots_id_uidx'
  ];
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY v_removed LOOP
    IF to_regclass('public.' || v_name) IS NOT NULL THEN
      RAISE EXCEPTION 'Redundant index still exists: %', v_name;
    END IF;
  END LOOP;

  FOREACH v_name IN ARRAY v_kept LOOP
    IF to_regclass('public.' || v_name) IS NULL THEN
      RAISE EXCEPTION 'Canonical index is missing: %', v_name;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_index
    WHERE indexrelid = 'public.stocks_lots_id_uidx'::regclass
      AND indisunique IS TRUE
      AND indisvalid IS TRUE
  ) THEN
    RAISE EXCEPTION 'Constraint-backed stocks_lots unique index was not preserved';
  END IF;
END;
$test$;

ROLLBACK;

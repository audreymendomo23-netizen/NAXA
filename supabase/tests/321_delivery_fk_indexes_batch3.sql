-- NAXA Replay regression: 18 index covers for delivery/courier foreign keys.
BEGIN;
SET LOCAL enable_seqscan = off;

DO $delivery_fk_index_structure$
DECLARE
  v record;
  v_line record;
  v_plan text;
  v_count integer := 0;
BEGIN
  FOR v IN
    SELECT * FROM (VALUES
      ('naxa_delivery_missions','naxa_delivery_missions_ready_by_fkey','ready_by','naxa_delivery_missions_ready_by_idx'),
      ('naxa_delivery_events','naxa_delivery_events_actor_id_fkey','actor_id','naxa_delivery_events_actor_id_idx'),
      ('naxa_delivery_events','naxa_delivery_events_pharmacie_id_fkey','pharmacie_id','naxa_delivery_events_pharmacie_time_idx'),
      ('naxa_delivery_commission_ledger','naxa_delivery_commission_ledger_pharmacie_id_fkey','pharmacie_id','naxa_delivery_commission_pharmacie_month_idx'),
      ('naxa_delivery_commission_ledger','naxa_delivery_commission_ledger_promoteur_id_fkey','promoteur_id','naxa_delivery_commission_promoteur_month_idx'),
      ('naxa_delivery_commission_ledger','naxa_delivery_ledger_zone_id_fkey','zone_id','naxa_delivery_commission_zone_idx'),
      ('naxa_delivery_mission_offers','naxa_delivery_mission_offers_pharmacie_id_fkey','pharmacie_id','naxa_delivery_offers_pharmacie_status_time_idx'),
      ('naxa_delivery_mission_offers','naxa_delivery_mission_offers_reservation_id_fkey','reservation_id','naxa_delivery_offers_reservation_idx'),
      ('naxa_delivery_payment_records','naxa_delivery_payment_records_caisse_session_id_fkey','caisse_session_id','naxa_delivery_payment_caisse_session_idx'),
      ('naxa_delivery_payment_records','naxa_delivery_payment_records_client_id_fkey','client_id','naxa_delivery_payment_client_time_idx'),
      ('naxa_delivery_payment_records','naxa_delivery_payment_records_declared_by_fkey','declared_by','naxa_delivery_payment_declared_by_idx'),
      ('naxa_delivery_payment_records','naxa_delivery_payment_records_livreur_id_fkey','livreur_id','naxa_delivery_payment_livreur_time_idx'),
      ('naxa_delivery_payment_records','naxa_delivery_payment_records_validated_by_fkey','validated_by','naxa_delivery_payment_validated_by_idx'),
      ('naxa_delivery_reviews','naxa_delivery_reviews_client_id_fkey','client_id','naxa_delivery_reviews_client_time_idx'),
      ('naxa_livreur_invites','naxa_livreur_invites_pharmacie_id_fkey','pharmacie_id','naxa_livreur_invites_pharmacie_time_idx'),
      ('naxa_livreur_invites','naxa_livreur_invites_assignment_id_fkey','assignment_id','naxa_livreur_invites_assignment_idx'),
      ('naxa_livreur_invites','naxa_livreur_invites_inviteur_id_fkey','inviteur_id','naxa_livreur_invites_inviteur_time_idx'),
      ('naxa_livreur_invites','naxa_livreur_invites_accepted_by_fkey','accepted_by','naxa_livreur_invites_accepted_by_idx')
    ) AS x(table_name,constraint_name,column_name,index_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
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

  IF v_count <> 18 THEN
    RAISE EXCEPTION 'Expected 18 delivery FK index assertions, got %',v_count;
  END IF;
END;
$delivery_fk_index_structure$;

ROLLBACK;
SELECT '321_delivery_fk_indexes_batch3_PASS' AS result,
       18 AS structural_assertions,
       18 AS planner_assertions;

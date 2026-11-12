-- NAXA — behavioral RLS regression for supplier-directory allow-list.
-- Uses a transaction-local canary. No Auth account or business row persists.
BEGIN;

SET LOCAL session_replication_role = replica;

INSERT INTO public.fournisseurs(nom, created_by)
VALUES (
  'NAXA_RLS_POLICY_TEST_20261109060000',
  '11111111-1111-4111-8111-111111111111'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);

DO $test$
DECLARE
  v_rows integer;
  v_insert_blocked boolean := false;
BEGIN
  -- A user without an active NAXA professional profile cannot read the row.
  SELECT count(*) INTO v_rows
  FROM public.fournisseurs
  WHERE nom = 'NAXA_RLS_POLICY_TEST_20261109060000';
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'Unauthorized user can read supplier directory data';
  END IF;

  -- The row is created by the same subject, but that alone grants no write access.
  UPDATE public.fournisseurs
     SET nom = 'NAXA_RLS_POLICY_TEST_UPDATED_20261109060000'
   WHERE nom = 'NAXA_RLS_POLICY_TEST_20261109060000';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'Unauthorized user can update a supplier';
  END IF;

  DELETE FROM public.fournisseurs
   WHERE nom = 'NAXA_RLS_POLICY_TEST_20261109060000';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'Unauthorized user can delete a supplier';
  END IF;

  BEGIN
    INSERT INTO public.fournisseurs(nom, created_by)
    VALUES (
      'NAXA_RLS_POLICY_TEST_INSERT_20261109060000',
      '11111111-1111-4111-8111-111111111111'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_insert_blocked := true;
  END;
  IF NOT v_insert_blocked THEN
    RAISE EXCEPTION 'Unauthorized user can insert a supplier';
  END IF;
END;
$test$;

ROLLBACK;

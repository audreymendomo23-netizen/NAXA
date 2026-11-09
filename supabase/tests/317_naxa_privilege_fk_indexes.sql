-- Regression test for targeted FK indexes on privilege-code lookup columns.
BEGIN;

DO $naxa_privilege_fk_indexes_test$
DECLARE
  v_arch_ok boolean;
  v_role_ok boolean;
BEGIN
  SELECT i.indisvalid AND i.indisready AND i.indnkeyatts >= 1
     AND (
       SELECT a.attname
       FROM unnest(i.indkey) WITH ORDINALITY k(attnum, ord)
       JOIN pg_attribute a
         ON a.attrelid = i.indrelid AND a.attnum = k.attnum
       WHERE k.ord = 1
     ) = 'privilege_code'
  INTO v_arch_ok
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'idx_naxa_architecture_privileges_privilege_code';

  SELECT i.indisvalid AND i.indisready AND i.indnkeyatts >= 1
     AND (
       SELECT a.attname
       FROM unnest(i.indkey) WITH ORDINALITY k(attnum, ord)
       JOIN pg_attribute a
         ON a.attrelid = i.indrelid AND a.attnum = k.attnum
       WHERE k.ord = 1
     ) = 'privilege_code'
  INTO v_role_ok
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'idx_naxa_role_privileges_privilege_code';

  IF COALESCE(v_arch_ok, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Missing/invalid index for naxa_architecture_privileges.privilege_code';
  END IF;
  IF COALESCE(v_role_ok, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Missing/invalid index for naxa_role_privileges.privilege_code';
  END IF;
END;
$naxa_privilege_fk_indexes_test$;

ROLLBACK;

-- NAXA additional security contract: extension placement and trigger-only RPC ACLs.
-- Run after security hardening migration 20261105142000.
BEGIN;

DO $test$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid=e.extnamespace
    WHERE e.extname='unaccent' AND n.nspname='extensions'
  ) THEN
    RAISE EXCEPTION 'unaccent extension must be installed in extensions schema';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid=e.extnamespace
    WHERE e.extname='pg_trgm' AND n.nspname='extensions'
  ) THEN
    RAISE EXCEPTION 'pg_trgm extension must be installed in extensions schema';
  END IF;

  IF extensions.unaccent('École à Yaoundé') <> 'Ecole a Yaounde' THEN
    RAISE EXCEPTION 'unaccent search function is not reachable after extension relocation';
  END IF;

  IF extensions.similarity('paracetamol','paracétamol') <= 0 THEN
    RAISE EXCEPTION 'pg_trgm similarity function is not reachable after extension relocation';
  END IF;

  IF has_function_privilege('anon','public.naxa_creer_proposition_favoris_apres_encaissement()','EXECUTE')
     OR has_function_privilege('authenticated','public.naxa_creer_proposition_favoris_apres_encaissement()','EXECUTE') THEN
    RAISE EXCEPTION 'Reservation post-payment trigger function remains directly callable';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgfoid='public.naxa_creer_proposition_favoris_apres_encaissement()'::regprocedure
      AND t.tgname='naxa_reservation_achat_favoris'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Reservation post-payment trigger must remain installed';
  END IF;
END
$test$;

ROLLBACK;

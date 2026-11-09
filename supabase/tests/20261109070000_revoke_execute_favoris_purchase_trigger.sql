-- Security contract: purchase reminder trigger remains attached but cannot
-- be invoked directly by application API roles.
BEGIN;
DO $test$
DECLARE
  v_function oid := 'public.naxa_creer_proposition_favoris_apres_encaissement()'::regprocedure;
BEGIN
  IF has_function_privilege('anon', v_function, 'EXECUTE')
     OR has_function_privilege('authenticated', v_function, 'EXECUTE')
     OR has_function_privilege('service_role', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'Trigger-only purchase function is directly executable by an API role';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgfoid = v_function
      AND tgrelid = 'public.reservations'::regclass
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Purchase-follow-up trigger is missing from public.reservations';
  END IF;
END;
$test$;
ROLLBACK;

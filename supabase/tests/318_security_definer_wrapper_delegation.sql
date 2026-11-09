-- Regression test for guarded SECURITY DEFINER compatibility facades.
-- The facade functions run as INVOKER; the delegated implementations
-- retain SECURITY DEFINER and enforce their own caller/scope checks.
BEGIN;

DO $naxa_wrapper_metadata_test$
BEGIN
  IF (SELECT prosecdef FROM pg_proc WHERE oid='public.caisse_cloturer(uuid,integer)'::regprocedure) IS NOT FALSE THEN
    RAISE EXCEPTION 'caisse_cloturer wrapper is not SECURITY INVOKER';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid='public.naxa_can_approve_marketplace_credit(uuid)'::regprocedure) IS NOT FALSE THEN
    RAISE EXCEPTION 'naxa_can_approve_marketplace_credit is not SECURITY INVOKER';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid='public.naxa_provision_caisse(uuid,uuid)'::regprocedure) IS NOT FALSE THEN
    RAISE EXCEPTION 'naxa_provision_caisse is not SECURITY INVOKER';
  END IF;

  IF NOT has_function_privilege('authenticated','public.caisse_cloturer(uuid,integer,text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','private.naxa_actor_can_approve_marketplace_credit(uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.naxa_grant_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated lost EXECUTE on a guarded delegated implementation';
  END IF;

  IF (SELECT prosecdef FROM pg_proc WHERE oid='public.caisse_cloturer(uuid,integer,text)'::regprocedure) IS NOT TRUE
     OR (SELECT prosecdef FROM pg_proc WHERE oid='private.naxa_actor_can_approve_marketplace_credit(uuid)'::regprocedure) IS NOT TRUE
     OR (SELECT prosecdef FROM pg_proc WHERE oid='public.naxa_grant_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text)'::regprocedure) IS NOT TRUE THEN
    RAISE EXCEPTION 'A guarded implementation lost SECURITY DEFINER';
  END IF;
END;
$naxa_wrapper_metadata_test$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"ffffffff-ffff-4fff-8fff-ffffffffffff"}', true);
SELECT set_config('request.jwt.claim.sub','ffffffff-ffff-4fff-8fff-ffffffffffff',true);

DO $naxa_wrapper_runtime_test$
DECLARE
  v_result boolean;
  v_message text;
BEGIN
  v_result := public.naxa_can_approve_marketplace_credit(NULL::uuid);
  IF v_result IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Marketplace wrapper did not delegate safely for a null pharmacy';
  END IF;

  BEGIN
    PERFORM public.naxa_provision_caisse(NULL::uuid,NULL::uuid);
    RAISE EXCEPTION 'Expected assignment implementation to reject null arguments';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Cible ou pharmacie invalide' THEN
      RAISE EXCEPTION 'Unexpected provision guard result: %',v_message;
    END IF;
  END;

  BEGIN
    PERFORM * FROM public.caisse_cloturer(NULL::uuid,0);
    RAISE EXCEPTION 'Expected caisse implementation to reject missing session';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Session caisse introuvable ou hors périmètre' THEN
      RAISE EXCEPTION 'Unexpected caisse guard result: %',v_message;
    END IF;
  END;
END;
$naxa_wrapper_runtime_test$;

RESET ROLE;
ROLLBACK;

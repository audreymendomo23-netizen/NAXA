-- Regression test for explicit telemetry RPC EXECUTE grants.
BEGIN;

DO $naxa_log_recherche_acl_test$
DECLARE
  v_anon boolean;
  v_authenticated boolean;
  v_service boolean;
  v_authenticator boolean;
  v_definer boolean;
BEGIN
  v_anon:=has_function_privilege('anon','public.log_recherche(text[])','EXECUTE');
  v_authenticated:=has_function_privilege('authenticated','public.log_recherche(text[])','EXECUTE');
  v_service:=has_function_privilege('service_role','public.log_recherche(text[])','EXECUTE');
  v_authenticator:=has_function_privilege('authenticator','public.log_recherche(text[])','EXECUTE');
  SELECT prosecdef INTO v_definer
  FROM pg_proc WHERE oid='public.log_recherche(text[])'::regprocedure;

  IF v_anon IS NOT TRUE OR v_authenticated IS NOT TRUE OR v_service IS NOT TRUE THEN
    RAISE EXCEPTION 'Intended telemetry role lost EXECUTE: anon %, authenticated %, service_role %',
      v_anon,v_authenticated,v_service;
  END IF;
  IF v_authenticator IS NOT FALSE THEN
    RAISE EXCEPTION 'authenticator still has direct EXECUTE via PUBLIC';
  END IF;
  IF v_definer IS NOT TRUE THEN
    RAISE EXCEPTION 'log_recherche no longer SECURITY DEFINER';
  END IF;
END;
$naxa_log_recherche_acl_test$;

ROLLBACK;

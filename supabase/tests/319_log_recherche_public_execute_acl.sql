-- Regression test: legacy telemetry RPCs are server-only.
-- The current application uses private helpers; client roles must not execute these RPCs.
BEGIN;
DO $naxa_log_recherche_acl_test$
DECLARE
  v_log_recherche regprocedure := 'public.log_recherche(text[])'::regprocedure;
  v_log_evenement regprocedure := 'public.log_evenement(text,uuid,uuid,text,integer,double precision,double precision)'::regprocedure;
BEGIN
  IF has_function_privilege('anon',v_log_recherche,'EXECUTE')
     OR has_function_privilege('authenticated',v_log_recherche,'EXECUTE')
     OR has_function_privilege('authenticator',v_log_recherche,'EXECUTE') THEN
    RAISE EXCEPTION 'log_recherche reste exécutable par un rôle client';
  END IF;
  IF has_function_privilege('anon',v_log_evenement,'EXECUTE')
     OR has_function_privilege('authenticated',v_log_evenement,'EXECUTE')
     OR has_function_privilege('authenticator',v_log_evenement,'EXECUTE') THEN
    RAISE EXCEPTION 'log_evenement reste exécutable par un rôle client';
  END IF;
  IF NOT has_function_privilege('service_role',v_log_recherche,'EXECUTE')
     OR NOT has_function_privilege('service_role',v_log_evenement,'EXECUTE') THEN
    RAISE EXCEPTION 'service_role a perdu les droits d''exécution requis';
  END IF;
END;
$naxa_log_recherche_acl_test$;
ROLLBACK;

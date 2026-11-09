-- NAXA — A trigger function is not an RPC endpoint.
-- Keep the AFTER UPDATE trigger intact while preventing direct PostgREST execution.
BEGIN;
REVOKE ALL ON FUNCTION public.naxa_creer_proposition_favoris_apres_encaissement()
  FROM PUBLIC, anon, authenticated, service_role;
COMMIT;

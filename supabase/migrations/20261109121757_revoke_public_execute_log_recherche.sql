-- Remove the broad PUBLIC EXECUTE grant on anonymous telemetry RPC.
-- Preserve the explicitly intended application roles and service_role.
REVOKE EXECUTE ON FUNCTION public.log_recherche(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_recherche(text[]) TO anon, authenticated, service_role;

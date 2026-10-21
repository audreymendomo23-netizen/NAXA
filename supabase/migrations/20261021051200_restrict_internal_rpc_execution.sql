-- Tighten execute privileges for functions that should not be callable as public RPCs.
-- Trigger functions are invoked by PostgreSQL triggers; clients do not need EXECUTE.
REVOKE EXECUTE ON FUNCTION public.naxa_reservation_receipt_snapshot() FROM PUBLIC, anon, authenticated;
-- This helper reports whether the current authenticated user belongs to a pharmacy.
-- Anonymous callers have no legitimate membership context.
REVOKE EXECUTE ON FUNCTION public.can_access_pharmacy(uuid) FROM anon;

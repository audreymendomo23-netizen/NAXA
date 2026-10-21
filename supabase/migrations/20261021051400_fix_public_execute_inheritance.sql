-- Ensure the pharmacy-membership helper is not executable through PUBLIC inheritance.
REVOKE EXECUTE ON FUNCTION public.can_access_pharmacy(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_pharmacy(uuid) TO authenticated;

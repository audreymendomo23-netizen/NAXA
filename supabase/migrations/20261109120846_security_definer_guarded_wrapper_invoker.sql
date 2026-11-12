-- Remove the unnecessary SECURITY DEFINER layer from compatibility
-- facades. The delegated implementations retain SECURITY DEFINER and
-- perform their own identity, role, scope, privilege and state checks.
ALTER FUNCTION public.caisse_cloturer(uuid, integer) SECURITY INVOKER;
ALTER FUNCTION public.naxa_can_approve_marketplace_credit(uuid) SECURITY INVOKER;
ALTER FUNCTION public.naxa_provision_caisse(uuid, uuid) SECURITY INVOKER;

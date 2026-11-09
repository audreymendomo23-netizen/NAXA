-- accrediter_responsable is a compatibility facade only.
-- Authorization remains enforced by the guarded accrediter_profile implementation.
ALTER FUNCTION public.accrediter_responsable(uuid, uuid) SECURITY INVOKER;

-- NAXA — thin authenticated RPC wrappers should not run as SECURITY DEFINER.
begin;

alter function public.assurance_configurer_convention(
  uuid,uuid,text,date,date,numeric,bigint,bigint
) security invoker;

alter function public.naxa_select_active_role(text,uuid) security invoker;

alter function public.can_access_pharmacy(uuid) security invoker;

-- The private function enforces auth.uid(), role and pharmacy scope itself.
-- Grant only to authenticated callers; the private schema is not exposed via PostgREST.
grant execute on function private.stats_pilotage_scope(integer) to authenticated;
alter function public.stats_pilotage_scope(integer) security invoker;

commit;

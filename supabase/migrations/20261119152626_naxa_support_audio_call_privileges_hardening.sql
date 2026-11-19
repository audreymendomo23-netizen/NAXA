begin;
revoke all on public.support_calls from service_role;
revoke all on public.support_call_events from service_role;
grant select on public.support_calls to service_role;
grant select on public.support_call_events to service_role;
commit;

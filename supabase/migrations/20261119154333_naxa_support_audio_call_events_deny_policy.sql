begin;
drop policy if exists support_call_events_deny_client_read on public.support_call_events;
create policy support_call_events_deny_client_read
on public.support_call_events
for select
to authenticated
using (false);
commit;

begin;
grant select on public.support_agents to authenticated;
drop policy if exists support_agents_self_read on public.support_agents;
create policy support_agents_self_read
on public.support_agents
for select
to authenticated
using (user_id=(select auth.uid()));
commit;
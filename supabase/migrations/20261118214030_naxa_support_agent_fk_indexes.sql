begin;
create index if not exists support_agent_events_actor_user_idx
  on public.support_agent_events(actor_user_id);
create index if not exists support_agent_permissions_granted_by_idx
  on public.support_agent_permissions(granted_by);
create index if not exists support_agent_permissions_revoked_by_idx
  on public.support_agent_permissions(revoked_by);
create index if not exists support_agents_created_by_idx
  on public.support_agents(created_by);
create index if not exists support_agents_updated_by_idx
  on public.support_agents(updated_by);
create index if not exists support_ticket_assignments_assigned_by_idx
  on public.support_ticket_assignments(assigned_by);
create index if not exists support_ticket_assignments_released_by_idx
  on public.support_ticket_assignments(released_by);
commit;
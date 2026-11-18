begin;

alter policy tickets_support_acces on public.tickets_support
using (
  (
    (is_admin() and exists (
      select 1 from public.profiles p
      where p.id=(select auth.uid()) and p.role='admin'::public.role_type and p.actif is true
    )) and naxa_business_function()='admin'
  )
  or (
    auteur_profile_id=(select auth.uid())
    and (
      type<>'support_naxa'
      or (
        exists(select 1 from public.profiles p
          where p.id=(select auth.uid()) and p.actif is true and p.role<>'admin'::public.role_type)
        and naxa_business_function() is not null
        and naxa_business_function()<>'admin'
      )
    )
  )
  or pharmacie_id=(select my_pharmacie())
  or private.naxa_support_agent_has_ticket_permission(id,'ticket_view_assigned')
);

alter policy messages_support_acces on public.messages_support
using (
  (
    (is_admin() and exists (
      select 1 from public.profiles p
      where p.id=(select auth.uid()) and p.role='admin'::public.role_type and p.actif is true
    )) and naxa_business_function()='admin'
  )
  or (
    interne=false and exists (
      select 1
      from public.tickets_support t
      join public.profiles me on me.id=(select auth.uid())
      where t.id=messages_support.ticket_id
        and (
          (
            t.type='support_naxa'
            and t.auteur_profile_id=(select auth.uid())
            and me.actif is true
            and me.role<>'admin'::public.role_type
            and naxa_business_function() is not null
            and naxa_business_function()<>'admin'
          )
          or (
            t.type<>'support_naxa'
            and (t.auteur_profile_id=(select auth.uid()) or t.pharmacie_id=(select my_pharmacie()))
          )
        )
    )
  )
  or (
    private.naxa_support_agent_has_ticket_permission(ticket_id,'ticket_view_assigned')
    and (interne=false or private.naxa_support_agent_has_ticket_permission(ticket_id,'ticket_internal_note'))
  )
);

drop policy if exists support_agent_assigned_ticket_read on public.tickets_support;
drop policy if exists support_agent_assigned_message_read on public.messages_support;

drop policy if exists support_agent_permissions_server_only on public.support_agent_permissions;
create policy support_agent_permissions_server_only
on public.support_agent_permissions for all to authenticated
using (false) with check (false);

drop policy if exists support_ticket_assignments_server_only on public.support_ticket_assignments;
create policy support_ticket_assignments_server_only
on public.support_ticket_assignments for all to authenticated
using (false) with check (false);

drop policy if exists support_agent_events_server_only on public.support_agent_events;
create policy support_agent_events_server_only
on public.support_agent_events for all to authenticated
using (false) with check (false);

commit;
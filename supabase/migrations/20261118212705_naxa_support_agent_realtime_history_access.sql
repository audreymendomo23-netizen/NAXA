begin;
create or replace function private.naxa_support_agent_has_ticket_permission(p_ticket_id uuid,p_permission text)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select auth.uid() is not null and exists (
    select 1 from public.support_agents a
    join public.support_ticket_assignments ta
      on ta.agent_user_id=a.user_id and ta.ticket_id=p_ticket_id and ta.released_at is null
    join public.support_agent_permissions p
      on p.agent_user_id=a.user_id and p.permission_code=p_permission and p.revoked_at is null
    join public.tickets_support t on t.id=ta.ticket_id
    where a.user_id=auth.uid() and a.status='active'
      and t.type='support_naxa' and t.pharmacie_id is null
  );
$function$;
create or replace function private.naxa_support_agent_can_read_attachment(p_path text)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select auth.uid() is not null and exists (
    select 1 from public.messages_support m
    join public.support_ticket_assignments ta
      on ta.ticket_id=m.ticket_id and ta.agent_user_id=auth.uid() and ta.released_at is null
    join public.support_agents a on a.user_id=ta.agent_user_id and a.status='active'
    join public.support_agent_permissions pa
      on pa.agent_user_id=a.user_id and pa.permission_code='attachments_read' and pa.revoked_at is null
    join public.tickets_support t on t.id=m.ticket_id and t.type='support_naxa' and t.pharmacie_id is null
    where m.piece_jointe_path=p_path and (m.interne=false or exists (
      select 1 from public.support_agent_permissions pi
      where pi.agent_user_id=a.user_id and pi.permission_code='ticket_internal_note' and pi.revoked_at is null
    ))
  );
$function$;
revoke all on function private.naxa_support_agent_has_ticket_permission(uuid,text) from public,anon;
revoke all on function private.naxa_support_agent_can_read_attachment(text) from public,anon;
grant execute on function private.naxa_support_agent_has_ticket_permission(uuid,text) to authenticated;
grant execute on function private.naxa_support_agent_can_read_attachment(text) to authenticated;
commit;
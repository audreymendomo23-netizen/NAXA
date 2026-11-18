begin;
create or replace function public.support_agent_claim_ticket(p_agent_user_id uuid,p_ticket_id uuid)
returns table(assignment_id uuid,ticket_id uuid)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_ticket public.tickets_support%rowtype;
  v_agent public.support_agents%rowtype;
  v_assignment_id uuid;
begin
  if p_agent_user_id is null or p_ticket_id is null then
    raise exception 'Agent et ticket obligatoires' using errcode='22023';
  end if;
  select * into v_agent from public.support_agents a
  where a.user_id=p_agent_user_id and a.status='active' and a.presence='available'
  for update;
  if not found then raise exception 'Agent inactif ou indisponible' using errcode='42501'; end if;
  if not exists(select 1 from public.support_agent_permissions p
    where p.agent_user_id=p_agent_user_id and p.permission_code='queue_view' and p.revoked_at is null)
    or not exists(select 1 from public.support_agent_permissions p
    where p.agent_user_id=p_agent_user_id and p.permission_code='ticket_view_assigned' and p.revoked_at is null) then
    raise exception 'Permissions de file ou de prise en charge absentes' using errcode='42501';
  end if;
  select t.* into v_ticket from public.tickets_support t where t.id=p_ticket_id for update;
  if not found then raise exception 'Ticket introuvable' using errcode='P0002'; end if;
  if v_ticket.type<>'support_naxa' or v_ticket.pharmacie_id is not null or v_ticket.statut<>'ouvert' then
    raise exception 'Ticket non éligible à la prise en charge depuis la file' using errcode='42501';
  end if;
  if exists(select 1 from public.support_ticket_assignments a
    where a.ticket_id=p_ticket_id and a.released_at is null) then
    raise exception 'Ticket déjà attribué' using errcode='23505';
  end if;
  insert into public.support_ticket_assignments(ticket_id,agent_user_id,assigned_by,assignment_source)
  values(p_ticket_id,p_agent_user_id,p_agent_user_id,'queue') returning id into v_assignment_id;
  update public.tickets_support set statut='en_cours',last_activity_at=now() where id=p_ticket_id;
  insert into public.support_agent_events(actor_user_id,agent_user_id,ticket_id,event_code,details)
  values(p_agent_user_id,p_agent_user_id,p_ticket_id,'ticket_claimed',
    jsonb_build_object('assignment_id',v_assignment_id,'source','queue'));
  assignment_id:=v_assignment_id;
  ticket_id:=p_ticket_id;
  return next;
end;
$function$;
revoke all on function public.support_agent_claim_ticket(uuid,uuid) from public,anon,authenticated;
grant execute on function public.support_agent_claim_ticket(uuid,uuid) to service_role;
commit;
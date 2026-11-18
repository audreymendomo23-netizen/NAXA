begin;

create or replace function public.support_agent_admin_update(
  p_agent_user_id uuid,
  p_actor_user_id uuid,
  p_status text,
  p_presence text,
  p_permissions text[] default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_agent public.support_agents%rowtype;
  v_now timestamptz := now();
  v_ticket_ids uuid[] := array[]::uuid[];
  v_permission text;
begin
  if p_agent_user_id is null or p_actor_user_id is null
     or p_status not in ('active','suspended','revoked')
     or p_presence not in ('available','unavailable') then
    raise exception 'Paramètres de gestion Agent invalides' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id=p_actor_user_id and p.role='admin'::public.role_type and p.actif is true
  ) then raise exception 'Administrateur actif requis' using errcode='42501'; end if;
  select * into v_agent from public.support_agents a where a.user_id=p_agent_user_id for update;
  if not found then raise exception 'Agent introuvable' using errcode='P0002'; end if;
  if v_agent.status='revoked' and p_status<>'revoked' then
    raise exception 'Un compte Agent révoqué ne peut pas être réactivé' using errcode='42501';
  end if;
  if p_permissions is not null then
    foreach v_permission in array p_permissions loop
      if v_permission not in (
        'queue_view','ticket_view_assigned','ticket_reply','ticket_internal_note',
        'ticket_assign','ticket_escalate','claims_handle','attachments_read',
        'audio_call','gmail_read','gmail_reply','reports_view'
      ) then raise exception 'Permission Agent inconnue' using errcode='22023'; end if;
    end loop;
  end if;
  update public.support_agents
  set status=p_status,
      presence=case when p_status='active' then p_presence else 'unavailable' end,
      updated_by=p_actor_user_id,updated_at=v_now
  where user_id=p_agent_user_id;
  if p_status<>'active' then
    select coalesce(array_agg(a.ticket_id),array[]::uuid[]) into v_ticket_ids
    from public.support_ticket_assignments a
    where a.agent_user_id=p_agent_user_id and a.released_at is null;
    update public.support_ticket_assignments
    set released_by=p_actor_user_id,released_at=v_now,
        release_reason=case when p_status='revoked' then 'agent_revoked' else 'agent_suspended' end
    where agent_user_id=p_agent_user_id and released_at is null;
    update public.tickets_support t
    set statut='ouvert',resolved_at=null,last_activity_at=v_now
    where t.id=any(v_ticket_ids) and t.type='support_naxa' and t.statut not in ('resolu','ferme');
    update public.support_agent_permissions
    set revoked_by=p_actor_user_id,revoked_at=v_now
    where agent_user_id=p_agent_user_id and revoked_at is null;
    insert into public.support_agent_events(actor_user_id,agent_user_id,ticket_id,event_code,details)
    select p_actor_user_id,p_agent_user_id,ticket_id,'ticket_released_after_agent_status_change',
      jsonb_build_object('new_status',p_status)
    from unnest(v_ticket_ids) as ticket_id;
  elsif p_permissions is not null then
    update public.support_agent_permissions
    set revoked_by=p_actor_user_id,revoked_at=v_now
    where agent_user_id=p_agent_user_id and revoked_at is null
      and not (permission_code=any(p_permissions));
    insert into public.support_agent_permissions(agent_user_id,permission_code,granted_by)
    select p_agent_user_id,permission_code,p_actor_user_id
    from unnest(p_permissions) as permission_code
    where not exists (
      select 1 from public.support_agent_permissions p
      where p.agent_user_id=p_agent_user_id and p.permission_code=permission_code and p.revoked_at is null
    );
  end if;
  insert into public.support_agent_events(actor_user_id,agent_user_id,event_code,details)
  values(p_actor_user_id,p_agent_user_id,
    case when p_status='suspended' then 'agent_suspended'
         when p_status='revoked' then 'agent_revoked' else 'agent_updated' end,
    jsonb_build_object('status',p_status,'presence',case when p_status='active' then p_presence else 'unavailable' end));
end;
$function$;
revoke all on function public.support_agent_admin_update(uuid,uuid,text,text,text[]) from public,anon,authenticated;
grant execute on function public.support_agent_admin_update(uuid,uuid,text,text,text[]) to service_role;
commit;
begin;
do $runtime$
declare
  v_ticket_id uuid;
  v_requester_id uuid;
  v_agent_id uuid := '5bff6417-ebd2-4c2f-b675-424632fa43a4'::uuid;
  v_call public.support_calls%rowtype;
  v_reaped integer;
  v_status text;
  v_reason text;
begin
  select t.id,t.auteur_profile_id
    into v_ticket_id,v_requester_id
  from public.tickets_support t
  join public.profiles p on p.id=t.auteur_profile_id
  where p.username='naxa_e2e_acheteur'
    and p.actif is true
    and t.type='support_naxa'
    and t.statut not in ('resolu','ferme')
  order by t.created_at desc
  limit 1;

  if v_ticket_id is null or v_requester_id is null then
    raise exception 'Fixture Replay Client/ticket introuvable';
  end if;
  if exists(select 1 from public.support_agents where user_id=v_agent_id) then
    raise exception 'Le compte Admin de fixture est déjà utilisé comme Agent';
  end if;

  insert into public.support_agents(
    user_id,username,first_name,last_name,status,presence,
    created_by,updated_by,must_change_password,date_of_birth,consent_accepted_at
  ) values (
    v_agent_id,'e2e_runtime_audio','Replay','Runtime','active','available',
    v_agent_id,v_agent_id,false,date '1990-01-01',clock_timestamp()
  );

  insert into public.support_agent_permissions(agent_user_id,permission_code,granted_by)
  values
    (v_agent_id,'audio_call',v_agent_id),
    (v_agent_id,'ticket_view_assigned',v_agent_id),
    (v_agent_id,'queue_view',v_agent_id);

  insert into public.support_ticket_assignments(
    ticket_id,agent_user_id,assigned_by,assignment_source
  ) values(v_ticket_id,v_agent_id,v_agent_id,'admin');

  v_call:=public.naxa_support_call_request(v_requester_id,v_ticket_id);
  if v_call.status<>'ringing' or v_call.agent_user_id is distinct from v_agent_id then
    raise exception 'Routage prioritaire de l’Agent affecté incorrect : %, %',v_call.status,v_call.agent_user_id;
  end if;
  perform public.naxa_support_call_heartbeat(v_requester_id,v_call.id);

  v_call:=public.naxa_support_call_accept(v_agent_id,v_call.id);
  if v_call.status<>'accepted' or v_call.agent_user_id is distinct from v_agent_id
    or v_call.agent_heartbeat_at is null then
    raise exception 'Acceptation atomique ou heartbeat Agent invalide';
  end if;
  perform public.naxa_support_call_heartbeat(v_agent_id,v_call.id);

  update public.support_calls
  set requester_heartbeat_at=clock_timestamp()-interval '3 minutes',
      agent_heartbeat_at=clock_timestamp()-interval '3 minutes'
  where id=v_call.id;

  v_reaped:=private.naxa_support_call_reap_expired();
  select status,end_reason into v_status,v_reason
  from public.support_calls where id=v_call.id;
  if v_status<>'failed' or v_reason<>'participant_heartbeat_expired' or v_reaped<1 then
    raise exception 'Expiration de session orpheline non exécutée : %, %, %',v_status,v_reason,v_reaped;
  end if;

  update public.support_ticket_assignments
  set released_by=v_agent_id,released_at=clock_timestamp(),release_reason='runtime_audio_test'
  where ticket_id=v_ticket_id and agent_user_id=v_agent_id and released_at is null;

  v_call:=public.naxa_support_call_request(v_requester_id,v_ticket_id);
  if v_call.status<>'queued' or v_call.agent_user_id is not null
    or v_call.queue_expires_at is null then
    raise exception 'Repli vers la file centrale incorrect : %, %',v_call.status,v_call.agent_user_id;
  end if;

  update public.support_calls
  set queue_expires_at=clock_timestamp()-interval '1 minute'
  where id=v_call.id;
  v_reaped:=private.naxa_support_call_reap_expired();
  select status,end_reason into v_status,v_reason
  from public.support_calls where id=v_call.id;
  if v_status<>'missed' or v_reason<>'central_queue_timeout' or v_reaped<1 then
    raise exception 'Expiration de file centrale non exécutée : %, %, %',v_status,v_reason,v_reaped;
  end if;

  raise notice 'PASS — routage assigné, acceptation, heartbeat demandeur/Agent, expiration orpheline et expiration file centrale';
end;
$runtime$;
rollback;

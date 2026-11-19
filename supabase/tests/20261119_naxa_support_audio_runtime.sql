begin;
do $runtime$
declare
  v_ticket_id uuid;
  v_requester_id uuid;
  v_call public.support_calls%rowtype;
  v_reaped integer;
  v_status text;
  v_reason text;
begin
  select t.id,t.auteur_profile_id
    into v_ticket_id,v_requester_id
  from public.tickets_support t
  join public.profiles p on p.id=t.auteur_profile_id
  where p.username='naxa_e2e_caisse'
    and p.actif is true
    and t.type='support_naxa'
    and t.statut not in ('resolu','ferme')
  order by t.created_at desc
  limit 1;

  if v_ticket_id is null or v_requester_id is null then
    raise exception 'Fixture Replay Client/ticket introuvable';
  end if;

  v_call:=public.naxa_support_call_request(v_requester_id,v_ticket_id);
  if v_call.status<>'queued' or v_call.agent_user_id is not null
    or v_call.queue_expires_at is null then
    raise exception 'Routage central sans Agent assigné incorrect : %, %',v_call.status,v_call.agent_user_id;
  end if;

  perform public.naxa_support_call_heartbeat(v_requester_id,v_call.id);
  update public.support_calls
  set queue_expires_at=clock_timestamp()-interval '1 minute'
  where id=v_call.id;

  v_reaped:=private.naxa_support_call_reap_expired();
  select status,end_reason into v_status,v_reason
  from public.support_calls where id=v_call.id;
  if v_status<>'missed' or v_reason<>'central_queue_timeout' or v_reaped<1 then
    raise exception 'Expiration de file centrale non exécutée : %, %, %',v_status,v_reason,v_reaped;
  end if;

  raise notice 'PASS — demande queued, heartbeat Client, expiration cron et transition missed';
end;
$runtime$;
rollback;

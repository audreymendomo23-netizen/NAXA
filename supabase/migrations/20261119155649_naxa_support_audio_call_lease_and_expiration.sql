begin;

alter table public.support_calls
  add column if not exists requester_heartbeat_at timestamptz,
  add column if not exists agent_heartbeat_at timestamptz,
  add column if not exists queue_expires_at timestamptz;

update public.support_calls
set requester_heartbeat_at=coalesce(requester_heartbeat_at,created_at),
    queue_expires_at=case
      when status in ('queued','ringing') and queue_expires_at is null
        then coalesce(fallback_at,created_at)+interval '60 seconds'
      else queue_expires_at
    end
where requester_heartbeat_at is null
   or (status in ('queued','ringing') and queue_expires_at is null);

create index if not exists support_calls_queue_expiry_idx
  on public.support_calls(queue_expires_at,created_at)
  where status in ('queued','ringing');

create or replace function private.naxa_support_call_requeue_or_finish(
  p_call_id uuid,p_agent_user_id uuid,p_reason text
)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare v_call_id uuid;
begin
 update public.support_calls
 set status='queued',
     agent_user_id=null,
     agent_heartbeat_at=null,
     fallback_at=clock_timestamp(),
     queue_expires_at=clock_timestamp()+interval '60 seconds',
     end_reason=left(p_reason,80),
     updated_at=clock_timestamp()
 where id=p_call_id
   and agent_user_id=p_agent_user_id
   and status='ringing'
 returning id into v_call_id;

 if v_call_id is not null then
   insert into public.support_call_events(call_id,actor_user_id,event_code,details)
   values(v_call_id,p_agent_user_id,'call_routed',
     jsonb_build_object('route','central_queue','reason',left(p_reason,80)));
 else
   perform private.naxa_support_call_finish_active(p_call_id,p_agent_user_id,p_reason);
 end if;
end; $function$;
revoke all on function private.naxa_support_call_requeue_or_finish(uuid,uuid,text) from public,anon,authenticated;

create or replace function private.naxa_support_agent_end_calls()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare v_call record; v_reason text;
begin
 if (new.status <> 'active' and old.status is distinct from new.status)
   or (new.must_change_password is true and old.must_change_password is distinct from new.must_change_password)
   or (new.consent_accepted_at is null and old.consent_accepted_at is not null) then
  v_reason:=case
   when new.status <> 'active' and old.status is distinct from new.status then 'agent_status_'||new.status
   when new.must_change_password is true then 'agent_password_rotation_required'
   else 'agent_consent_withdrawn'
  end;
  for v_call in select id from public.support_calls
    where agent_user_id=new.user_id and status in ('ringing','accepted') loop
    perform private.naxa_support_call_requeue_or_finish(v_call.id,new.user_id,v_reason);
  end loop;
 end if;
 return new;
end; $function$;
revoke all on function private.naxa_support_agent_end_calls() from public,anon,authenticated;
drop trigger if exists trg_naxa_support_agent_end_calls on public.support_agents;
create trigger trg_naxa_support_agent_end_calls
after update of status,must_change_password,consent_accepted_at on public.support_agents
for each row when (
 (old.status is distinct from new.status and new.status <> 'active')
 or (old.must_change_password is distinct from new.must_change_password and new.must_change_password is true)
 or (old.consent_accepted_at is not null and new.consent_accepted_at is null)
)
execute function private.naxa_support_agent_end_calls();

create or replace function private.naxa_support_agent_permission_end_calls()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare v_call record;
begin
 if new.permission_code in ('audio_call','ticket_view_assigned')
   and old.revoked_at is null and new.revoked_at is not null then
  for v_call in select id from public.support_calls
   where agent_user_id=new.agent_user_id and status in ('ringing','accepted') loop
   perform private.naxa_support_call_requeue_or_finish(
     v_call.id,new.agent_user_id,'agent_permission_revoked_'||new.permission_code
   );
  end loop;
 end if;
 return new;
end; $function$;
revoke all on function private.naxa_support_agent_permission_end_calls() from public,anon,authenticated;
drop trigger if exists trg_naxa_support_agent_permission_end_calls on public.support_agent_permissions;
create trigger trg_naxa_support_agent_permission_end_calls after update of revoked_at on public.support_agent_permissions
for each row when (
 old.revoked_at is null and new.revoked_at is not null
 and new.permission_code in ('audio_call','ticket_view_assigned')
)
execute function private.naxa_support_agent_permission_end_calls();

create or replace function private.naxa_support_agent_delete_end_calls()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare v_call record;
begin
 for v_call in select id from public.support_calls
   where agent_user_id=old.user_id and status in ('ringing','accepted') loop
   perform private.naxa_support_call_requeue_or_finish(v_call.id,old.user_id,'agent_account_deleted');
 end loop;
 return old;
end; $function$;
revoke all on function private.naxa_support_agent_delete_end_calls() from public,anon,authenticated;
drop trigger if exists trg_naxa_support_agent_delete_end_calls on public.support_agents;
create trigger trg_naxa_support_agent_delete_end_calls before delete on public.support_agents
for each row execute function private.naxa_support_agent_delete_end_calls();

create or replace function public.naxa_support_call_request(p_actor_user_id uuid,p_ticket_id uuid)
returns public.support_calls
language plpgsql
security definer
set search_path=''
as $function$
declare
 v_ticket public.tickets_support%rowtype;
 v_call public.support_calls%rowtype;
 v_agent_id uuid;
 v_now timestamptz:=clock_timestamp();
begin
 select t.* into v_ticket
 from public.tickets_support t
 join public.profiles p on p.id=t.auteur_profile_id
 where t.id=p_ticket_id and t.auteur_profile_id=p_actor_user_id
   and t.type='support_naxa' and t.pharmacie_id is null and p.actif is true
 for update of t;
 if not found then raise exception 'Dossier support inaccessible'; end if;
 if v_ticket.statut in ('resolu','ferme') then raise exception 'Dossier résolu ou clôturé'; end if;

 select * into v_call from public.support_calls
 where ticket_id=p_ticket_id and status in ('queued','ringing','accepted')
 for update;
 if found then return v_call; end if;

 insert into public.support_calls(
   ticket_id,requester_user_id,status,fallback_at,
   requester_heartbeat_at,queue_expires_at
 ) values (
   p_ticket_id,p_actor_user_id,'queued',v_now,v_now,v_now+interval '60 seconds'
 ) returning * into v_call;

 insert into public.support_call_events(call_id,actor_user_id,event_code,details)
 values(v_call.id,p_actor_user_id,'call_requested','{}'::jsonb);

 select a.agent_user_id into v_agent_id
 from public.support_ticket_assignments a
 join public.support_agents sa on sa.user_id=a.agent_user_id
 join public.support_agent_permissions p on p.agent_user_id=a.agent_user_id
 where a.ticket_id=p_ticket_id and a.released_at is null
   and sa.status='active' and sa.presence='available'
   and sa.must_change_password is false and sa.consent_accepted_at is not null
   and p.permission_code='audio_call' and p.revoked_at is null
   and exists(
     select 1 from public.support_agent_permissions view_grant
     where view_grant.agent_user_id=a.agent_user_id
       and view_grant.permission_code='ticket_view_assigned' and view_grant.revoked_at is null
   )
   and not exists(
     select 1 from public.support_calls busy
     where busy.agent_user_id=a.agent_user_id and busy.status in ('ringing','accepted')
   )
 order by a.assigned_at asc
 limit 1
 for update of sa skip locked;

 if v_agent_id is not null then
   update public.support_calls
   set agent_user_id=v_agent_id,
       status='ringing',
       fallback_at=v_now+interval '20 seconds',
       queue_expires_at=v_now+interval '80 seconds',
       updated_at=v_now
   where id=v_call.id returning * into v_call;
   insert into public.support_call_events(call_id,actor_user_id,event_code,details)
   values(v_call.id,p_actor_user_id,'call_routed',jsonb_build_object('route','assigned_agent','ring_seconds',20));
 else
   insert into public.support_call_events(call_id,actor_user_id,event_code,details)
   values(v_call.id,p_actor_user_id,'call_routed',jsonb_build_object('route','central_queue','queue_seconds',60));
 end if;
 return v_call;
end; $function$;

create or replace function public.naxa_support_call_accept(p_actor_user_id uuid,p_call_id uuid)
returns public.support_calls
language plpgsql
security definer
set search_path=''
as $function$
declare
 v_call public.support_calls%rowtype;
 v_agent public.support_agents%rowtype;
 v_assignment public.support_ticket_assignments%rowtype;
 v_ticket_id uuid;
 v_had_assignment boolean:=false;
 v_reassigned boolean:=false;
 v_now timestamptz:=clock_timestamp();
begin
 select c.ticket_id into v_ticket_id from public.support_calls c where c.id=p_call_id;
 if not found then raise exception 'Appel introuvable'; end if;

 perform 1
 from public.tickets_support t
 join public.profiles requester_profile on requester_profile.id=t.auteur_profile_id
 where t.id=v_ticket_id and t.type='support_naxa'
   and t.statut not in ('resolu','ferme') and requester_profile.actif is true
 for update of t;
 if not found then raise exception 'Le dossier n’est plus ouvert'; end if;

 select * into v_agent from public.support_agents where user_id=p_actor_user_id for update;
 if not found or v_agent.status<>'active' or v_agent.presence<>'available'
   or v_agent.must_change_password is true or v_agent.consent_accepted_at is null
 then raise exception 'Agent inactif ou indisponible'; end if;
 if not exists(
   select 1 from public.support_agent_permissions p
   where p.agent_user_id=p_actor_user_id and p.permission_code='audio_call' and p.revoked_at is null
 ) or not exists(
   select 1 from public.support_agent_permissions p
   where p.agent_user_id=p_actor_user_id and p.permission_code='ticket_view_assigned' and p.revoked_at is null
 ) then raise exception 'Permission appel audio ou lecture du dossier absente'; end if;

 select * into v_call from public.support_calls where id=p_call_id for update;
 if not found or v_call.ticket_id is distinct from v_ticket_id
   or v_call.status not in ('queued','ringing') then
   raise exception 'Appel indisponible ou déjà pris';
 end if;
 if v_call.queue_expires_at is not null and v_call.queue_expires_at<=v_now then
   raise exception 'La demande d’appel a expiré';
 end if;
 if v_call.status='ringing' and v_call.agent_user_id is not null
   and v_call.agent_user_id<>p_actor_user_id and v_call.fallback_at>v_now then
   raise exception 'L’Agent affecté dispose encore de la priorité d’appel';
 end if;
 if v_call.agent_user_id is distinct from p_actor_user_id
   and not exists(
     select 1 from public.support_agent_permissions queue_grant
     where queue_grant.agent_user_id=p_actor_user_id
       and queue_grant.permission_code='queue_view' and queue_grant.revoked_at is null
   ) then
   raise exception 'Permission de prise en charge de la file centrale absente';
 end if;
 if exists(
   select 1 from public.support_calls busy
   where busy.agent_user_id=p_actor_user_id and busy.id<>p_call_id
     and busy.status in ('ringing','accepted')
 ) then raise exception 'Cet Agent est déjà engagé dans un appel'; end if;

 select * into v_assignment
 from public.support_ticket_assignments a
 where a.ticket_id=v_call.ticket_id and a.released_at is null
 for update;
 v_had_assignment:=found;
 if v_had_assignment and v_assignment.agent_user_id<>p_actor_user_id then
  v_reassigned:=true;
  update public.support_ticket_assignments
    set released_by=p_actor_user_id,released_at=v_now,release_reason='audio_call_queue_routing'
  where id=v_assignment.id;
  v_had_assignment:=false;
 end if;
 if not v_had_assignment then
  insert into public.support_ticket_assignments(ticket_id,agent_user_id,assigned_by,assignment_source)
  values(v_call.ticket_id,p_actor_user_id,p_actor_user_id,'queue');
 end if;

 update public.support_calls
  set agent_user_id=p_actor_user_id,
      status='accepted',
      accepted_at=v_now,
      agent_heartbeat_at=v_now,
      queue_expires_at=null,
      updated_at=v_now
 where id=p_call_id returning * into v_call;

 insert into public.support_call_events(call_id,actor_user_id,event_code,details)
 values(p_call_id,p_actor_user_id,
   case when v_reassigned then 'call_reassigned' else 'call_accepted' end,
   jsonb_build_object('agent_user_id',p_actor_user_id));
 return v_call;
end; $function$;

create or replace function public.naxa_support_call_transition(p_actor_user_id uuid,p_call_id uuid,p_action text)
returns public.support_calls
language plpgsql
security definer
set search_path=''
as $function$
declare
 v_call public.support_calls%rowtype;
 v_event text;
 v_status text;
 v_reason text;
 v_now timestamptz:=clock_timestamp();
begin
 select * into v_call from public.support_calls where id=p_call_id for update;
 if not found then raise exception 'Appel introuvable'; end if;
 if p_actor_user_id is distinct from v_call.requester_user_id
    and p_actor_user_id is distinct from v_call.agent_user_id then
   raise exception 'Participant non autorisé';
 end if;

 if p_action='cancel' and p_actor_user_id=v_call.requester_user_id
    and v_call.status in ('queued','ringing') then
  v_status:='cancelled'; v_event:='call_cancelled'; v_reason:='requester_cancelled';
 elsif p_action='decline' and p_actor_user_id=v_call.agent_user_id and v_call.status='ringing' then
  v_status:='queued'; v_event:='call_declined'; v_reason:='agent_declined';
 elsif p_action='end' and v_call.status='accepted' then
  v_status:='completed'; v_event:='call_completed'; v_reason:='participant_ended';
 elsif p_action='fail' and v_call.status='accepted' then
  v_status:='failed'; v_event:='call_failed'; v_reason:='reconnect_timeout';
 else
  raise exception 'Transition d’appel invalide';
 end if;

 if v_status='queued' then
  update public.support_calls
  set agent_user_id=null,agent_heartbeat_at=null,status=v_status,
      fallback_at=v_now,queue_expires_at=v_now+interval '60 seconds',
      updated_at=v_now,end_reason=v_reason
  where id=p_call_id returning * into v_call;
 else
  update public.support_calls
  set status=v_status,ended_at=v_now,end_reason=v_reason,
      queue_expires_at=null,updated_at=v_now
  where id=p_call_id returning * into v_call;
 end if;

 insert into public.support_call_events(call_id,actor_user_id,event_code,details)
 values(p_call_id,p_actor_user_id,v_event,jsonb_build_object('reason',v_reason));
 return v_call;
end; $function$;

create or replace function public.naxa_support_call_heartbeat(p_actor_user_id uuid,p_call_id uuid)
returns public.support_calls
language plpgsql
security definer
set search_path=''
as $function$
declare
 v_call public.support_calls%rowtype;
 v_agent public.support_agents%rowtype;
 v_now timestamptz:=clock_timestamp();
begin
 if p_actor_user_id is null then
   raise exception 'Session heartbeat non autorisée';
 end if;
 select * into v_call from public.support_calls where id=p_call_id for update;
 if not found or v_call.status not in ('queued','ringing','accepted') then
   raise exception 'Appel inactif ou expiré';
 end if;

 if v_call.requester_user_id=p_actor_user_id then
   if not exists(select 1 from public.profiles p where p.id=p_actor_user_id and p.actif is true) then
     raise exception 'Profil demandeur suspendu';
   end if;
   if not exists(select 1 from public.tickets_support t where t.id=v_call.ticket_id and t.statut not in ('resolu','ferme')) then
     raise exception 'Dossier fermé';
   end if;
   update public.support_calls
   set requester_heartbeat_at=v_now,updated_at=v_now
   where id=p_call_id returning * into v_call;
 elsif v_call.agent_user_id=p_actor_user_id and v_call.status='accepted' then
   select * into v_agent from public.support_agents a where a.user_id=p_actor_user_id;
   if not found or v_agent.status<>'active' or v_agent.must_change_password is true or v_agent.consent_accepted_at is null then
     raise exception 'Compte Agent suspendu ou non activé';
   end if;
   if not exists(select 1 from public.support_agent_permissions p
     where p.agent_user_id=p_actor_user_id and p.permission_code='audio_call' and p.revoked_at is null)
     or not exists(select 1 from public.support_agent_permissions p
     where p.agent_user_id=p_actor_user_id and p.permission_code='ticket_view_assigned' and p.revoked_at is null) then
     raise exception 'Permissions Agent révoquées';
   end if;
   update public.support_calls
   set agent_heartbeat_at=v_now,updated_at=v_now
   where id=p_call_id returning * into v_call;
 else
   raise exception 'Participant heartbeat non autorisé';
 end if;
 return v_call;
end; $function$;

create or replace function private.naxa_support_call_reap_expired()
returns integer
language plpgsql
security definer
set search_path=''
as $function$
declare v_call record; v_count integer:=0; v_now timestamptz:=clock_timestamp();
begin
 for v_call in
   select id from public.support_calls
   where status in ('queued','ringing')
     and queue_expires_at is not null and queue_expires_at<=v_now
   for update skip locked
 loop
   update public.support_calls
   set status='missed',ended_at=v_now,end_reason='central_queue_timeout',
       queue_expires_at=null,updated_at=v_now
   where id=v_call.id and status in ('queued','ringing');
   if found then
     insert into public.support_call_events(call_id,actor_user_id,event_code,details)
     values(v_call.id,null,'call_failed',jsonb_build_object('reason','central_queue_timeout'));
     v_count:=v_count+1;
   end if;
 end loop;

 for v_call in
   select id from public.support_calls
   where status='accepted'
     and (
       requester_heartbeat_at is null or requester_heartbeat_at < v_now-interval '120 seconds'
       or agent_heartbeat_at is null or agent_heartbeat_at < v_now-interval '120 seconds'
     )
   for update skip locked
 loop
   perform private.naxa_support_call_finish_active(v_call.id,null,'participant_heartbeat_expired');
   v_count:=v_count+1;
 end loop;
 return v_count;
end; $function$;
revoke all on function private.naxa_support_call_reap_expired() from public,anon,authenticated,service_role;
revoke all on function public.naxa_support_call_heartbeat(uuid,uuid) from public,anon,authenticated;
grant execute on function public.naxa_support_call_heartbeat(uuid,uuid) to service_role;

do $schedule$
declare v_job_id bigint;
begin
 for v_job_id in select jobid from cron.job where jobname='naxa-support-call-reaper' loop
   perform cron.unschedule(v_job_id);
 end loop;
 perform cron.schedule('naxa-support-call-reaper','* * * * *',
   'select private.naxa_support_call_reap_expired();');
end; $schedule$;

commit;

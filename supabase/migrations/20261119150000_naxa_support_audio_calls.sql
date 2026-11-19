begin;
create table if not exists public.support_calls (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.tickets_support(id) on delete cascade,
 requester_user_id uuid not null references auth.users(id) on delete restrict,
 agent_user_id uuid references public.support_agents(user_id) on delete set null,
 status text not null default 'queued' check(status in ('queued','ringing','accepted','cancelled','declined','completed','failed','missed')),
 fallback_at timestamptz not null default now(), accepted_at timestamptz, ended_at timestamptz,
 end_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint support_calls_end_state_ck check(
  (status in ('completed','cancelled','declined','failed','missed') and ended_at is not null)
  or (status in ('queued','ringing','accepted') and ended_at is null)),
 constraint support_calls_accept_state_ck check((status='accepted' and accepted_at is not null) or status<>'accepted')
);
create unique index if not exists support_calls_one_active_per_ticket_uq on public.support_calls(ticket_id) where status in ('queued','ringing','accepted');
create unique index if not exists support_calls_one_active_per_requester_uq on public.support_calls(requester_user_id) where status in ('queued','ringing','accepted');
create unique index if not exists support_calls_one_active_per_agent_uq on public.support_calls(agent_user_id) where agent_user_id is not null and status in ('ringing','accepted');
create index if not exists support_calls_queue_idx on public.support_calls(status,fallback_at,created_at) where status in ('queued','ringing');
create table if not exists public.support_call_events (
 id uuid primary key default gen_random_uuid(),
 call_id uuid not null references public.support_calls(id) on delete cascade,
 actor_user_id uuid references auth.users(id) on delete set null,
 event_code text not null check(event_code in ('call_requested','call_routed','call_accepted','call_declined','call_cancelled','call_completed','call_reassigned','call_failed')),
 details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists support_call_events_call_idx on public.support_call_events(call_id,created_at);
alter table public.support_calls enable row level security;
alter table public.support_call_events enable row level security;
revoke all on public.support_calls from public,anon,authenticated;
revoke all on public.support_call_events from public,anon,authenticated;
grant select on public.support_calls to authenticated;
grant select,insert,update,delete on public.support_calls to service_role;
grant select,insert,update,delete on public.support_call_events to service_role;
drop policy if exists support_calls_participant_read on public.support_calls;
create policy support_calls_participant_read on public.support_calls for select to authenticated
using(requester_user_id=(select auth.uid()) or agent_user_id=(select auth.uid()));

create or replace function private.naxa_support_call_realtime_access(p_topic text,p_actor_user_id uuid)
returns boolean language plpgsql stable security definer set search_path=''
as $function$
declare v_call_id uuid;
begin
 if p_actor_user_id is null or p_actor_user_id is distinct from (select auth.uid()) then return false; end if;
 if p_topic !~ '^naxa-support-call:[0-9a-fA-F-]{36}$' then return false; end if;
 v_call_id := substring(p_topic from 19)::uuid;
 return exists(select 1 from public.support_calls c where c.id=v_call_id and c.status='accepted'
   and (c.requester_user_id=p_actor_user_id or c.agent_user_id=p_actor_user_id));
end; $function$;
revoke all on function private.naxa_support_call_realtime_access(text,uuid) from public,anon;
grant execute on function private.naxa_support_call_realtime_access(text,uuid) to authenticated,service_role;
drop policy if exists naxa_support_call_broadcast_read on realtime.messages;
create policy naxa_support_call_broadcast_read on realtime.messages for select to authenticated
using(extension='broadcast' and (select private.naxa_support_call_realtime_access((select realtime.topic()),(select auth.uid()))));
drop policy if exists naxa_support_call_broadcast_write on realtime.messages;
create policy naxa_support_call_broadcast_write on realtime.messages for insert to authenticated
with check(extension='broadcast' and (select private.naxa_support_call_realtime_access((select realtime.topic()),(select auth.uid()))));

create or replace function private.naxa_support_call_finish_active(
 p_call_id uuid,p_actor_user_id uuid,p_reason text
)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_ended_id uuid;
begin
 update public.support_calls set status='failed',ended_at=clock_timestamp(),
  end_reason=left(p_reason,80),updated_at=clock_timestamp()
 where id=p_call_id and status in ('queued','ringing','accepted')
 returning id into v_ended_id;
 if v_ended_id is not null then
  insert into public.support_call_events(call_id,actor_user_id,event_code,details)
  values(v_ended_id,p_actor_user_id,'call_failed',jsonb_build_object('reason',left(p_reason,80)));
 end if;
end; $function$;
revoke all on function private.naxa_support_call_finish_active(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.naxa_support_call_finish_active(uuid,uuid,text) to service_role;

create or replace function private.naxa_support_agent_end_calls()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_call record;
begin
 if new.status <> 'active' and old.status is distinct from new.status then
  for v_call in select id from public.support_calls
    where agent_user_id=new.user_id and status in ('queued','ringing','accepted') loop
    perform private.naxa_support_call_finish_active(v_call.id,new.user_id,'agent_status_'||new.status);
  end loop;
 end if;
 return new;
end; $function$;
revoke all on function private.naxa_support_agent_end_calls() from public,anon,authenticated;
drop trigger if exists trg_naxa_support_agent_end_calls on public.support_agents;
create trigger trg_naxa_support_agent_end_calls after update of status on public.support_agents
for each row when (old.status is distinct from new.status and new.status <> 'active')
execute function private.naxa_support_agent_end_calls();

create or replace function private.naxa_support_agent_permission_end_calls()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_call record;
begin
 if new.permission_code='audio_call' and old.revoked_at is null and new.revoked_at is not null then
  for v_call in select id from public.support_calls
   where agent_user_id=new.agent_user_id and status in ('queued','ringing','accepted') loop
   perform private.naxa_support_call_finish_active(v_call.id,new.revoked_by,'agent_audio_permission_revoked');
  end loop;
 end if;
 return new;
end; $function$;
revoke all on function private.naxa_support_agent_permission_end_calls() from public,anon,authenticated;
drop trigger if exists trg_naxa_support_agent_permission_end_calls on public.support_agent_permissions;
create trigger trg_naxa_support_agent_permission_end_calls after update of revoked_at on public.support_agent_permissions
for each row when (old.revoked_at is null and new.revoked_at is not null and new.permission_code='audio_call')
execute function private.naxa_support_agent_permission_end_calls();

create or replace function private.naxa_support_ticket_end_calls()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_call record;
begin
 if new.statut in ('resolu','ferme') and old.statut is distinct from new.statut then
  for v_call in select id from public.support_calls where ticket_id=new.id and status in ('queued','ringing','accepted') loop
   perform private.naxa_support_call_finish_active(v_call.id,null,'ticket_'||new.statut);
  end loop;
 end if;
 return new;
end; $function$;
revoke all on function private.naxa_support_ticket_end_calls() from public,anon,authenticated;
drop trigger if exists trg_naxa_support_ticket_end_calls on public.tickets_support;
create trigger trg_naxa_support_ticket_end_calls after update of statut on public.tickets_support
for each row when (new.statut in ('resolu','ferme') and old.statut is distinct from new.statut)
execute function private.naxa_support_ticket_end_calls();

create or replace function public.naxa_support_call_request(p_actor_user_id uuid,p_ticket_id uuid)
returns public.support_calls language plpgsql security definer set search_path=''
as $function$
declare v_ticket public.tickets_support%rowtype; v_call public.support_calls%rowtype; v_agent_id uuid;
begin
 select t.* into v_ticket from public.tickets_support t join public.profiles p on p.id=t.auteur_profile_id
 where t.id=p_ticket_id and t.auteur_profile_id=p_actor_user_id and t.type='support_naxa' and t.pharmacie_id is null and p.actif is true
 for update of t;
 if not found then raise exception 'Dossier support inaccessible'; end if;
 if v_ticket.statut in ('resolu','ferme') then raise exception 'Dossier résolu ou clôturé'; end if;
 insert into public.support_calls(ticket_id,requester_user_id,status,fallback_at)
 values(p_ticket_id,p_actor_user_id,'queued',clock_timestamp()) returning * into v_call;
 select a.agent_user_id into v_agent_id from public.support_ticket_assignments a
 join public.support_agents sa on sa.user_id=a.agent_user_id
 join public.support_agent_permissions p on p.agent_user_id=a.agent_user_id
 where a.ticket_id=p_ticket_id and a.released_at is null and sa.status='active' and sa.presence='available'
 and sa.must_change_password is false and sa.consent_accepted_at is not null
 and p.permission_code='audio_call' and p.revoked_at is null
 and not exists(select 1 from public.support_calls busy where busy.agent_user_id=a.agent_user_id and busy.status in ('ringing','accepted'))
 limit 1;
 if v_agent_id is not null then
  update public.support_calls set agent_user_id=v_agent_id,status='ringing',fallback_at=clock_timestamp()+interval '20 seconds',updated_at=clock_timestamp()
  where id=v_call.id returning * into v_call;
  insert into public.support_call_events(call_id,actor_user_id,event_code,details)
  values(v_call.id,p_actor_user_id,'call_routed',jsonb_build_object('route','assigned_agent'));
 else
  insert into public.support_call_events(call_id,actor_user_id,event_code,details)
  values(v_call.id,p_actor_user_id,'call_routed',jsonb_build_object('route','central_queue'));
 end if;
 insert into public.support_call_events(call_id,actor_user_id,event_code,details)
 values(v_call.id,p_actor_user_id,'call_requested','{}'::jsonb);
 return v_call;
end; $function$;

create or replace function public.naxa_support_call_accept(p_actor_user_id uuid,p_call_id uuid)
returns public.support_calls language plpgsql security definer set search_path=''
as $function$
declare v_call public.support_calls%rowtype; v_agent public.support_agents%rowtype;
 v_assignment public.support_ticket_assignments%rowtype; v_had_assignment boolean:=false;
begin
 select * into v_agent from public.support_agents where user_id=p_actor_user_id for update;
 if not found or v_agent.status<>'active' or v_agent.presence<>'available' or v_agent.must_change_password is true or v_agent.consent_accepted_at is null
 then raise exception 'Agent inactif ou indisponible'; end if;
 if not exists(select 1 from public.support_agent_permissions p where p.agent_user_id=p_actor_user_id and p.permission_code='audio_call' and p.revoked_at is null)
 or not exists(select 1 from public.support_agent_permissions p where p.agent_user_id=p_actor_user_id and p.permission_code='ticket_view_assigned' and p.revoked_at is null)
 then raise exception 'Permission appel audio ou lecture du dossier absente'; end if;
 select * into v_call from public.support_calls where id=p_call_id for update;
 if not found or v_call.status not in ('queued','ringing') then raise exception 'Appel indisponible ou déjà pris'; end if;
 if v_call.status='ringing' and v_call.agent_user_id is not null and v_call.agent_user_id<>p_actor_user_id and v_call.fallback_at>clock_timestamp()
 then raise exception 'L’Agent affecté dispose encore de la priorité d’appel'; end if;
 if exists(select 1 from public.support_calls busy where busy.agent_user_id=p_actor_user_id and busy.id<>p_call_id and busy.status in ('ringing','accepted'))
 then raise exception 'Cet Agent est déjà engagé dans un appel'; end if;
 perform 1 from public.tickets_support t where t.id=v_call.ticket_id and t.type='support_naxa' and t.statut not in ('resolu','ferme') for update;
 if not found then raise exception 'Le dossier n’est plus ouvert'; end if;
 select * into v_assignment from public.support_ticket_assignments a where a.ticket_id=v_call.ticket_id and a.released_at is null for update;
 v_had_assignment:=found;
 if v_had_assignment and v_assignment.agent_user_id<>p_actor_user_id then
  update public.support_ticket_assignments set released_by=p_actor_user_id,released_at=clock_timestamp(),release_reason='audio_call_queue_routing' where id=v_assignment.id;
  v_had_assignment:=false;
 end if;
 if not v_had_assignment then
  insert into public.support_ticket_assignments(ticket_id,agent_user_id,assigned_by,assignment_source)
  values(v_call.ticket_id,p_actor_user_id,p_actor_user_id,'queue');
 end if;
 update public.support_calls set agent_user_id=p_actor_user_id,status='accepted',accepted_at=clock_timestamp(),fallback_at=clock_timestamp(),updated_at=clock_timestamp()
 where id=p_call_id returning * into v_call;
 insert into public.support_call_events(call_id,actor_user_id,event_code,details)
 values(p_call_id,p_actor_user_id,case when v_had_assignment then 'call_accepted' else 'call_reassigned' end,jsonb_build_object('agent_user_id',p_actor_user_id));
 return v_call;
end; $function$;

create or replace function public.naxa_support_call_transition(p_actor_user_id uuid,p_call_id uuid,p_action text)
returns public.support_calls language plpgsql security definer set search_path=''
as $function$
declare v_call public.support_calls%rowtype; v_event text; v_status text; v_reason text;
begin
 select * into v_call from public.support_calls where id=p_call_id for update;
 if not found then raise exception 'Appel introuvable'; end if;
 if p_actor_user_id is distinct from v_call.requester_user_id and p_actor_user_id is distinct from v_call.agent_user_id
 then raise exception 'Participant non autorisé'; end if;
 if p_action='cancel' and p_actor_user_id=v_call.requester_user_id and v_call.status in ('queued','ringing') then
  v_status:='cancelled'; v_event:='call_cancelled'; v_reason:='requester_cancelled';
 elsif p_action='decline' and p_actor_user_id=v_call.agent_user_id and v_call.status='ringing' then
  v_status:='queued'; v_event:='call_declined'; v_reason:='agent_declined';
 elsif p_action='end' and v_call.status='accepted' then
  v_status:='completed'; v_event:='call_completed'; v_reason:='participant_ended';
 else raise exception 'Transition d’appel invalide'; end if;
 if v_status='queued' then
  update public.support_calls set agent_user_id=null,status=v_status,fallback_at=clock_timestamp(),updated_at=clock_timestamp(),end_reason=v_reason where id=p_call_id returning * into v_call;
 else
  update public.support_calls set status=v_status,ended_at=clock_timestamp(),end_reason=v_reason,updated_at=clock_timestamp() where id=p_call_id returning * into v_call;
 end if;
 insert into public.support_call_events(call_id,actor_user_id,event_code,details)
 values(p_call_id,p_actor_user_id,v_event,jsonb_build_object('reason',v_reason));
 return v_call;
end; $function$;

revoke all on function public.naxa_support_call_request(uuid,uuid) from public,anon,authenticated;
revoke all on function public.naxa_support_call_accept(uuid,uuid) from public,anon,authenticated;
revoke all on function public.naxa_support_call_transition(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.naxa_support_call_request(uuid,uuid) to service_role;
grant execute on function public.naxa_support_call_accept(uuid,uuid) to service_role;
grant execute on function public.naxa_support_call_transition(uuid,uuid,text) to service_role;
comment on table public.support_calls is 'Métadonnées des appels audio. Aucun SDP, candidat ICE, audio, vidéo ou enregistrement stocké.';
comment on table public.support_call_events is 'Journal append-only des transitions d’appel ; aucun secret ni payload média.';
commit;

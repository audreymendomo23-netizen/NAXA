begin;
create or replace function private.naxa_support_agent_event_immutable()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  if tg_op='UPDATE'
    and new.id is not distinct from old.id
    and new.event_code is not distinct from old.event_code
    and new.details is not distinct from old.details
    and new.created_at is not distinct from old.created_at
    and (new.actor_user_id is not distinct from old.actor_user_id
      or (old.actor_user_id is not null and new.actor_user_id is null))
    and (new.agent_user_id is not distinct from old.agent_user_id
      or (old.agent_user_id is not null and new.agent_user_id is null))
    and (new.ticket_id is not distinct from old.ticket_id
      or (old.ticket_id is not null and new.ticket_id is null)) then
    return new;
  end if;
  raise exception 'Le journal des Agents NAXA est immuable';
end;
$function$;
revoke all on function private.naxa_support_agent_event_immutable() from public,anon,authenticated;
commit;
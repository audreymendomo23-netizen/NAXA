begin;
alter table public.support_agents
  add column if not exists date_of_birth date not null,
  add column if not exists age_verified_at timestamptz not null default now(),
  add column if not exists consent_accepted_at timestamptz;

create or replace function private.naxa_support_agent_age_guard()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  if new.date_of_birth is null
     or new.date_of_birth > (current_date - interval '18 years')::date then
    raise exception 'Un Agent du service client doit être majeur (18 ans minimum)' using errcode='23514';
  end if;
  if new.age_verified_at is null then new.age_verified_at:=now(); end if;
  return new;
end;
$function$;
revoke all on function private.naxa_support_agent_age_guard() from public,anon,authenticated;
drop trigger if exists trg_naxa_support_agent_age_guard on public.support_agents;
create trigger trg_naxa_support_agent_age_guard
before insert or update of date_of_birth on public.support_agents
for each row execute function private.naxa_support_agent_age_guard();
commit;
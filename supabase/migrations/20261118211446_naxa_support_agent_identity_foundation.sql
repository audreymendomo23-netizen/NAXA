begin;

create table if not exists public.support_agents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  first_name text not null,
  last_name text not null,
  display_name text generated always as (btrim(first_name || ' ' || last_name)) stored,
  status text not null default 'invited'
    check (status in ('invited','active','suspended','revoked')),
  presence text not null default 'unavailable'
    check (presence in ('available','unavailable')),
  last_seen_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_agents_username_format_ck
    check (username = lower(btrim(username)) and username ~ '^[a-z0-9][a-z0-9._-]{2,29}$'),
  constraint support_agents_first_name_ck check (length(btrim(first_name)) between 2 and 80),
  constraint support_agents_last_name_ck check (length(btrim(last_name)) between 2 and 80)
);

create unique index if not exists support_agents_username_uq
  on public.support_agents (username);

create table if not exists public.support_agent_permissions (
  id uuid primary key default gen_random_uuid(),
  agent_user_id uuid not null references public.support_agents(user_id) on delete cascade,
  permission_code text not null check (permission_code in (
    'queue_view','ticket_view_assigned','ticket_reply','ticket_internal_note',
    'ticket_assign','ticket_escalate','claims_handle','attachments_read',
    'audio_call','gmail_read','gmail_reply','reports_view'
  )),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  constraint support_agent_permissions_revocation_ck
    check ((revoked_at is null and revoked_by is null) or revoked_at is not null)
);

create unique index if not exists support_agent_permissions_active_uq
  on public.support_agent_permissions(agent_user_id, permission_code)
  where revoked_at is null;

create table if not exists public.support_ticket_assignments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets_support(id) on delete cascade,
  agent_user_id uuid not null references public.support_agents(user_id) on delete restrict,
  assigned_by uuid references auth.users(id) on delete set null,
  assignment_source text not null default 'admin'
    check (assignment_source in ('admin','queue','escalation')),
  assigned_at timestamptz not null default now(),
  released_by uuid references auth.users(id) on delete set null,
  released_at timestamptz,
  release_reason text,
  constraint support_ticket_assignments_release_ck
    check ((released_at is null and released_by is null) or released_at is not null)
);

create unique index if not exists support_ticket_assignments_one_active_ticket_uq
  on public.support_ticket_assignments(ticket_id)
  where released_at is null;
create index if not exists support_ticket_assignments_agent_active_idx
  on public.support_ticket_assignments(agent_user_id, assigned_at desc)
  where released_at is null;

create table if not exists public.support_agent_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  agent_user_id uuid references public.support_agents(user_id) on delete set null,
  ticket_id uuid references public.tickets_support(id) on delete set null,
  event_code text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint support_agent_events_event_code_ck
    check (event_code ~ '^[a-z][a-z0-9_]{2,79}$')
);

create index if not exists support_agent_events_agent_created_idx
  on public.support_agent_events(agent_user_id, created_at desc);
create index if not exists support_agent_events_ticket_created_idx
  on public.support_agent_events(ticket_id, created_at desc);

alter table public.support_agents enable row level security;
alter table public.support_agent_permissions enable row level security;
alter table public.support_ticket_assignments enable row level security;
alter table public.support_agent_events enable row level security;

revoke all on public.support_agents from public, anon, authenticated;
revoke all on public.support_agent_permissions from public, anon, authenticated;
revoke all on public.support_ticket_assignments from public, anon, authenticated;
revoke all on public.support_agent_events from public, anon, authenticated;
grant select, insert, update, delete on public.support_agents to service_role;
grant select, insert, update, delete on public.support_agent_permissions to service_role;
grant select, insert, update, delete on public.support_ticket_assignments to service_role;
grant select, insert, update, delete on public.support_agent_events to service_role;

create or replace function private.naxa_guard_support_agent_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if exists (select 1 from public.profiles p where p.id = new.user_id) then
    raise exception 'Un Agent NAXA ne peut pas posséder de profil Client/Partenaire/Admin';
  end if;
  return new;
end;
$function$;
revoke all on function private.naxa_guard_support_agent_profile() from public, anon, authenticated;
drop trigger if exists trg_naxa_guard_support_agent_profile on public.support_agents;
create trigger trg_naxa_guard_support_agent_profile
before insert or update of user_id on public.support_agents
for each row execute function private.naxa_guard_support_agent_profile();

create or replace function private.naxa_guard_profile_not_support_agent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if exists (select 1 from public.support_agents a where a.user_id = new.id) then
    raise exception 'Un Agent NAXA ne peut pas recevoir de profil Client/Partenaire/Admin';
  end if;
  return new;
end;
$function$;
revoke all on function private.naxa_guard_profile_not_support_agent() from public, anon, authenticated;
drop trigger if exists trg_naxa_guard_profile_not_support_agent on public.profiles;
create trigger trg_naxa_guard_profile_not_support_agent
before insert or update of id on public.profiles
for each row execute function private.naxa_guard_profile_not_support_agent();

create or replace function private.naxa_support_agent_event_immutable()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'Le journal des Agents NAXA est immuable';
end;
$function$;
revoke all on function private.naxa_support_agent_event_immutable() from public, anon, authenticated;
drop trigger if exists trg_naxa_support_agent_event_immutable on public.support_agent_events;
create trigger trg_naxa_support_agent_event_immutable
before update or delete on public.support_agent_events
for each row execute function private.naxa_support_agent_event_immutable();

comment on table public.support_agents is
  'Identité interne NAXA du service client. Liée à Auth mais volontairement absente de public.profiles et des rôles métier.';
comment on table public.support_agent_permissions is
  'Permissions atomiques des Agents NAXA, gérées exclusivement côté serveur par Admin.';
comment on table public.support_ticket_assignments is
  'Historique d’affectation des dossiers support aux Agents NAXA ; un seul agent actif par ticket.';
comment on table public.support_agent_events is
  'Journal append-only des actions d’administration et des Agents NAXA.';

commit;

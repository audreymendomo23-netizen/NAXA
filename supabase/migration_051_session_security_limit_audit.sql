-- NAXA — Sécurité sessions sans service payant
-- Contrat V3.7 : maximum 4 sessions simultanées par compte, 5e refusée,
-- aucune expulsion automatique, journal d'audit conservé.
begin;

create table if not exists public.session_audit (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null check (event in ('created','ended')),
  occurred_at timestamptz not null default now(),
  user_agent text,
  ip inet
);

create index if not exists session_audit_user_time_idx
  on public.session_audit(user_id,occurred_at desc);

alter table public.session_audit enable row level security;
revoke all on public.session_audit from anon,authenticated;

create or replace function private.naxa_enforce_session_limit()
returns trigger
language plpgsql
security definer
set search_path to ''
as $body$
declare
  active_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  select count(*) into active_count
  from auth.sessions
  where user_id=new.user_id;

  if active_count >= 4 then
    raise exception 'SESSION_LIMIT_REACHED';
  end if;

  return new;
end;
$body$;

create or replace function private.naxa_audit_session()
returns trigger
language plpgsql
security definer
set search_path to ''
as $body$
begin
  if tg_op='INSERT' then
    insert into public.session_audit(session_id,user_id,event,user_agent,ip)
    values(new.id,new.user_id,'created',new.user_agent,new.ip);
  elsif tg_op='DELETE' then
    insert into public.session_audit(session_id,user_id,event,user_agent,ip)
    values(old.id,old.user_id,'ended',old.user_agent,old.ip);
  end if;
  return coalesce(new,old);
end;
$body$;

drop trigger if exists trg_naxa_session_limit on auth.sessions;
create trigger trg_naxa_session_limit
before insert on auth.sessions
for each row execute function private.naxa_enforce_session_limit();

drop trigger if exists trg_naxa_session_audit on auth.sessions;
create trigger trg_naxa_session_audit
after insert or delete on auth.sessions
for each row execute function private.naxa_audit_session();

revoke execute on function private.naxa_enforce_session_limit() from public,anon,authenticated;
revoke execute on function private.naxa_audit_session() from public,anon,authenticated;

commit;

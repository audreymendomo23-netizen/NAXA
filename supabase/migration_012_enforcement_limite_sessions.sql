-- NAXA — Enforcement atomique de la limite de 4 sessions
-- Le contrôle applicatif reste présent pour un message UX immédiat.
-- Ce trigger est l'enforcement DB : deux connexions concurrentes ne peuvent
-- pas dépasser 4 sessions, car les créations sont sérialisées par utilisateur.

create or replace function public.naxa_enforce_session_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, auth
as $$
declare
  current_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  select count(*)::integer
    into current_count
    from auth.sessions
   where user_id = new.user_id
     and (not_after is null or not_after > now());

  if current_count >= 4 then
    raise exception 'NAXA_SESSION_LIMIT_REACHED'
      using errcode = 'P0001',
            detail = 'Maximum de 4 sessions actives atteint.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_naxa_session_limit on auth.sessions;

create trigger trg_naxa_session_limit
before insert on auth.sessions
for each row
execute function public.naxa_enforce_session_limit();

revoke execute on function public.naxa_enforce_session_limit() from public;
revoke execute on function public.naxa_enforce_session_limit() from anon;
revoke execute on function public.naxa_enforce_session_limit() from authenticated;
revoke execute on function public.naxa_enforce_session_limit() from service_role;

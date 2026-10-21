-- Remove NAXA's custom four-concurrent-session cap.
-- Keep session audit triggers intact; remove only the rejecting trigger.
drop trigger if exists trg_naxa_session_limit on auth.sessions;

-- Make the trigger function harmless if a trigger is accidentally reintroduced.
create or replace function public.naxa_enforce_session_limit()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'auth'
as $function$
begin
  return new;
end;
$function$;

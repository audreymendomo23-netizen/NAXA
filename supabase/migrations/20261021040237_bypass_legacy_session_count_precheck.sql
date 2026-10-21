-- Compatibility bridge for the currently deployed NAXA login route.
-- Its old pre-check rejects logins when this RPC returns 4 or more.
-- The cap is intentionally disabled, so report no blocking count until that
-- old route is replaced by the main-branch implementation.
create or replace function public.naxa_session_count(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'auth'
as $function$
begin
  return 0;
end;
$function$;

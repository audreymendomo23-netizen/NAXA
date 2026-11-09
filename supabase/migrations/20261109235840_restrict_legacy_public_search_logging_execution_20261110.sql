-- Restrict obsolete public telemetry RPCs to trusted server-side execution.
-- The current application uses the private helpers introduced by migration 262.
begin;

revoke all privileges on function public.log_recherche(text[]) from public, anon, authenticated;
revoke all privileges on function public.log_evenement(text, uuid, uuid, text, integer, double precision, double precision) from public, anon, authenticated;

grant execute on function public.log_recherche(text[]) to service_role;
grant execute on function public.log_evenement(text, uuid, uuid, text, integer, double precision, double precision) to service_role;

commit;

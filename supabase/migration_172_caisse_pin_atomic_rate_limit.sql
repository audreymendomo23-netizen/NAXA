-- Atomic PIN lockout counters; callable only by the trusted server-side service role.
create or replace function public.caisse_pin_register_failure(p_user_id uuid)
returns table(attempts integer, locked_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then raise exception 'Utilisateur requis'; end if;
  return query
  update public.caisse_security_credentials c
  set pin_failed_attempts = least(5, coalesce(c.pin_failed_attempts, 0) + 1),
      pin_locked_until = case
        when least(5, coalesce(c.pin_failed_attempts, 0) + 1) >= 5 then now() + interval '15 minutes'
        else null
      end,
      updated_at = now()
  where c.user_id = p_user_id
  returning c.pin_failed_attempts, c.pin_locked_until;
end;
$$;

create or replace function public.caisse_pin_reset_failures(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.caisse_security_credentials
  set pin_failed_attempts = 0, pin_locked_until = null, updated_at = now()
  where user_id = p_user_id;
$$;

revoke all on function public.caisse_pin_register_failure(uuid) from public, anon, authenticated;
revoke all on function public.caisse_pin_reset_failures(uuid) from public, anon, authenticated;
grant execute on function public.caisse_pin_register_failure(uuid) to service_role;
grant execute on function public.caisse_pin_reset_failures(uuid) to service_role;

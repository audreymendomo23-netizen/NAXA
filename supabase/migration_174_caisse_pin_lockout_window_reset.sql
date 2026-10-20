-- NAXA 174 — reset the PIN failure window after the lock expires.
create or replace function public.caisse_pin_register_failure(p_user_id uuid)
returns table(attempts integer, locked_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts integer;
  v_locked_until timestamptz;
begin
  if p_user_id is null then raise exception 'Utilisateur requis'; end if;
  update public.caisse_security_credentials c
  set pin_failed_attempts = least(5,
        (case when c.pin_locked_until is not null and c.pin_locked_until <= now()
              then 0 else coalesce(c.pin_failed_attempts,0) end) + 1),
      pin_locked_until = case
        when least(5,(case when c.pin_locked_until is not null and c.pin_locked_until <= now()
                           then 0 else coalesce(c.pin_failed_attempts,0) end)+1) >= 5
          then now()+interval '15 minutes'
        else null
      end,
      updated_at = now()
  where c.user_id=p_user_id
  returning c.pin_failed_attempts,c.pin_locked_until into v_attempts,v_locked_until;
  if not found then raise exception 'Identifiants de sécurité introuvables'; end if;
  return query select v_attempts,v_locked_until;
end;
$$;
revoke all on function public.caisse_pin_register_failure(uuid) from public,anon,authenticated;
grant execute on function public.caisse_pin_register_failure(uuid) to service_role;

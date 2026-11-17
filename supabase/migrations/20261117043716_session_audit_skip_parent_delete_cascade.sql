begin;

-- Une suppression Auth en cascade retire déjà les audits via la FK.
-- Ne pas réinsérer un événement SESSION_REVOKED qui référence le parent
-- auth.users en cours de suppression : cela violerait la FK user_id.
create or replace function public.naxa_audit_session_delete()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_pharmacie_id uuid;
begin
  select p.pharmacie_id
    into v_pharmacie_id
    from public.profiles p
   where p.id = old.user_id;

  if exists (
    select 1
      from auth.users u
     where u.id = old.user_id
  ) then
    perform public.naxa_record_session_audit(
      'SESSION_REVOKED',
      old.id,
      old.user_id,
      v_pharmacie_id,
      old.ip,
      old.user_agent,
      null
    );
  end if;

  return old;
end;
$function$;

commit;

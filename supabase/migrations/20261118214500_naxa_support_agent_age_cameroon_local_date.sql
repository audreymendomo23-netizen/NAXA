begin;
create or replace function private.naxa_support_agent_age_guard()
returns trigger language plpgsql set search_path = ''
as $function$
declare
  v_local_today date;
begin
  v_local_today := timezone('Africa/Douala', now())::date;
  if new.date_of_birth is null
     or new.date_of_birth > (v_local_today - interval '18 years')::date then
    raise exception 'Un Agent du service client doit être majeur (18 ans minimum)' using errcode='23514';
  end if;
  if new.age_attested_at is null then new.age_attested_at:=now(); end if;
  return new;
end;
$function$;
revoke all on function private.naxa_support_agent_age_guard() from public,anon,authenticated;
commit;
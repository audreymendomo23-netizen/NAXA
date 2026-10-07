begin;

do $$
declare
  u4 uuid;
  u0 uuid;
  fake_session uuid := gen_random_uuid();
  before_count integer;
  after_count integer;
  audit_created integer;
  audit_ended integer;
begin
  select user_id into u4
  from auth.sessions
  group by user_id
  having count(*)=4
  order by user_id
  limit 1;

  select id into u0
  from auth.users
  where id<>u4
  order by created_at
  limit 1;

  if u4 is null or u0 is null then
    raise exception 'PART3_SESSION_FIXTURE_MISSING';
  end if;

  select count(*) into before_count from auth.sessions where user_id=u4;

  begin
    insert into auth.sessions(id,user_id,created_at,updated_at)
    values(gen_random_uuid(),u4,now(),now());
    raise exception 'PART3_FAIL_FIFTH_SESSION_ACCEPTED';
  exception when others then
    if sqlerrm='PART3_FAIL_FIFTH_SESSION_ACCEPTED' then raise; end if;
  end;

  select count(*) into after_count from auth.sessions where user_id=u4;
  if before_count<>4 or after_count<>4 then
    raise exception 'PART3_FAIL_EXISTING_SESSIONS_EVICTED';
  end if;

  insert into auth.sessions(id,user_id,created_at,updated_at,user_agent,ip)
  values(fake_session,u0,now(),now(),'NAXA-PART3-TEST','127.0.0.1');

  select count(*) into audit_created
  from public.session_audit
  where session_id=fake_session and event='created';

  if audit_created<>1 then
    raise exception 'PART3_FAIL_SESSION_AUDIT_CREATED';
  end if;

  delete from auth.sessions where id=fake_session;

  select count(*) into audit_ended
  from public.session_audit
  where session_id=fake_session and event='ended';

  if audit_ended<>1 then
    raise exception 'PART3_FAIL_SESSION_AUDIT_ENDED';
  end if;

  raise notice 'PART3_SESSION_SECURITY_GREEN';
end $$;

rollback;

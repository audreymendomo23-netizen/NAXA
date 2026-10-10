begin;

do $$
declare
  v_user uuid:=gen_random_uuid();
  v_pharmacie uuid:=gen_random_uuid();
  v_session uuid;
  v_count integer;
  v_rejected boolean:=false;
begin
  set local session_replication_role = replica;
  insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
  values(v_user,'authenticated','authenticated','naxa035_'||substr(replace(v_user::text,'-',''),1,12)||'@invalid.local','',now(),now());
  set local session_replication_role = origin;

  insert into public.pharmacies(id,nom,ville,lat,lng,actif)
  values(v_pharmacie,'NAXA Test 035','Yaoundé',3.8570,11.5110,true);

  insert into public.profiles(id,role,username,actif,pharmacie_id)
  values(v_user,'caisse','naxa035_'||substr(replace(v_user::text,'-',''),1,10),true,v_pharmacie);

  for i in 1..4 loop
    v_session:=gen_random_uuid();
    insert into auth.sessions(id,user_id,not_after,user_agent)
    values(v_session,v_user,now()+interval '1 hour','NAXA-035');
  end loop;

  select count(*) into v_count from auth.sessions where user_id=v_user and (not_after is null or not_after>now());
  if v_count<>4 then raise exception 'ASSERT 1: 4 sessions attendues'; end if;

  begin
    insert into auth.sessions(id,user_id,not_after,user_agent)
    values(gen_random_uuid(),v_user,now()+interval '1 hour','NAXA-035');
  exception when others then
    if sqlerrm not like '%NAXA_SESSION_LIMIT_REACHED%' then raise; end if;
    v_rejected:=true;
  end;

  if not v_rejected then raise exception 'ASSERT 2: 5e session non refusée'; end if;

  select count(*) into v_count from auth.sessions where user_id=v_user;
  if v_count<>4 then raise exception 'ASSERT 3: 5e session persistée'; end if;

  perform public.naxa_record_session_limit_rejected(gen_random_uuid(),v_user,v_pharmacie,'127.0.0.1','NAXA-035','password');

  select count(*) into v_count from public.naxa_session_audit where user_id=v_user and event_type='SESSION_CREATED';
  if v_count<>4 then raise exception 'ASSERT 4: 4 SESSION_CREATED attendues'; end if;

  select count(*) into v_count from public.naxa_session_audit where user_id=v_user and event_type='SESSION_LIMIT_REJECTED';
  if v_count<>1 then raise exception 'ASSERT 5: 1 SESSION_LIMIT_REJECTED attendue'; end if;

  delete from auth.sessions where user_id=v_user;
  select count(*) into v_count from public.naxa_session_audit where user_id=v_user and event_type='SESSION_REVOKED';
  if v_count<>4 then raise exception 'ASSERT 6: 4 SESSION_REVOKED attendues'; end if;

  raise notice 'NAXA 035 — 6/6 PASS';
end $$;

rollback;
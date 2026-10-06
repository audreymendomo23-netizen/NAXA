begin;
do $$
declare
  v_user uuid:=gen_random_uuid(); v_pharmacie uuid:=gen_random_uuid(); v_session uuid:=gen_random_uuid(); v_count integer;
begin
  insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
  values(v_user,'authenticated','authenticated','naxa035_'||substr(replace(v_user::text,'-',''),1,12)||'@invalid.local','',now(),now());
  insert into public.profiles(id,role,username,actif,pharmacie_id)
  values(v_user,'caisse','naxa035_'||substr(replace(v_user::text,'-',''),1,10),true,v_pharmacie)
  on conflict(id) do update set pharmacie_id=excluded.pharmacie_id,actif=true;
  insert into public.naxa_session_audit(session_id,user_id,pharmacie_id,event_type) values(v_session,v_user,v_pharmacie,'SESSION_CREATED'),(v_session,v_user,v_pharmacie,'SESSION_REVOKED');
  select count(*) into v_count from public.naxa_session_audit where user_id=v_user and session_id=v_session;
  if v_count<>2 then raise exception 'ASSERT 1: created/revoked'; end if;
  perform public.naxa_record_session_limit_rejected(gen_random_uuid(),v_user,v_pharmacie,'127.0.0.1','NAXA test 035','password');
  select count(*) into v_count from public.naxa_session_audit where user_id=v_user and event_type='SESSION_LIMIT_REJECTED';
  if v_count<>1 then raise exception 'ASSERT 2: rejected'; end if;
  raise notice 'NAXA 035 — audit comportemental PASS';
end $$;
rollback;
begin;

do $$
declare
  v_promoteur uuid:=gen_random_uuid();
  v_client uuid:=gen_random_uuid();
  v_pharmacie_in uuid:=gen_random_uuid();
  v_pharmacie_out uuid:=gen_random_uuid();
  v_visible integer;
begin
  set local session_replication_role=replica;
  insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
  values
    (v_promoteur,'authenticated','authenticated','naxa036p_'||substr(replace(v_promoteur::text,'-',''),1,10)||'@invalid.local','',now(),now()),
    (v_client,'authenticated','authenticated','naxa036c_'||substr(replace(v_client::text,'-',''),1,10)||'@invalid.local','',now(),now());
  set local session_replication_role=origin;

  insert into public.profiles(id,role,username,actif)
  values
    (v_promoteur,'promoteur','naxa036p_'||substr(replace(v_promoteur::text,'-',''),1,10),true),
    (v_client,'client','naxa036c_'||substr(replace(v_client::text,'-',''),1,10),true);

  insert into public.pharmacies(id,nom,lat,lng) values
    (v_pharmacie_in,'NAXA TEST 036 IN',3.8667,11.5167),
    (v_pharmacie_out,'NAXA TEST 036 OUT',3.9000,11.5500);

  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values(v_promoteur,v_pharmacie_in,true);

  insert into public.naxa_session_audit(session_id,user_id,pharmacie_id,event_type)
  values
    (gen_random_uuid(),v_client,v_pharmacie_in,'SESSION_CREATED'),
    (gen_random_uuid(),v_client,v_pharmacie_out,'SESSION_CREATED'),
    (gen_random_uuid(),v_promoteur,v_pharmacie_out,'SESSION_CREATED');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub',v_promoteur::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  select count(*) into v_visible
  from public.naxa_session_audit
  where user_id=v_client;

  if v_visible<>1 then raise exception 'ASSERT 1: Promoteur voit une trace client hors scope'; end if;

  select count(*) into v_visible
  from public.naxa_session_audit
  where user_id=v_promoteur;

  if v_visible<>1 then raise exception 'ASSERT 2: Promoteur ne voit pas sa propre trace'; end if;

  perform set_config('request.jwt.claim.sub',v_client::text,true);

  select count(*) into v_visible
  from public.naxa_session_audit
  where user_id=v_promoteur;

  if v_visible<>0 then raise exception 'ASSERT 3: Client voit la trace du Promoteur'; end if;

  raise notice 'NAXA 036 — 3/3 assertions RLS de cloisonnement PASS';
end $$;

rollback;
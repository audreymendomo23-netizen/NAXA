-- NAXA 267 — isolation inter-pharmacies Comptable.
-- Fixtures synthétiques transactionnelles : aucune donnée persistée après ROLLBACK.
begin;

do $test$
declare
  v_admin uuid := '02670000-0000-4000-8000-000000000001';
  v_promoteur uuid := '02670000-0000-4000-8000-000000000002';
  v_comptable uuid := '02670000-0000-4000-8000-000000000003';
  v_a uuid := '02670000-0000-4000-8000-000000000101';
  v_b uuid := '02670000-0000-4000-8000-000000000102';
  v_session_a uuid;
  v_session_b uuid := '02670000-0000-4000-8000-000000000201';
  v_ended timestamptz;
begin
  set local session_replication_role = replica;
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
    ('00000000-0000-0000-0000-000000000000',v_admin,'authenticated','authenticated','naxa-test-267-admin@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
    ('00000000-0000-0000-0000-000000000000',v_promoteur,'authenticated','authenticated','naxa-test-267-promoteur@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
    ('00000000-0000-0000-0000-000000000000',v_comptable,'authenticated','authenticated','naxa-test-267-comptable@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now())
  on conflict(id) do nothing;
  set local session_replication_role = origin;

  insert into public.pharmacies(id,nom,ville,lat,lng,slug,est_demo,actif)
  values
    (v_a,'NAXA Test 267 A','Yaoundé',3.8511,11.5051,'naxa-test-267-a',false,true),
    (v_b,'NAXA Test 267 B','Yaoundé',3.8512,11.5052,'naxa-test-267-b',false,true)
  on conflict(id) do nothing;

  insert into public.profiles(id,role,actif)
  values(v_admin,'admin',true)
  on conflict(id) do update set role='admin',actif=true;

  insert into public.profiles(id,role,actif,fonction_interne,niveau_interne,niveau_hierarchique,architecture_code)
  values(v_promoteur,'promoteur',true,'promoteur',1,1,'PARENTS_AINES_CADETS')
  on conflict(id) do update set role='promoteur',actif=true,fonction_interne='promoteur',niveau_interne=1,niveau_hierarchique=1,architecture_code='PARENTS_AINES_CADETS';

  insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut,architecture_code)
  values(v_promoteur,30000,current_date+30,'active','PARENTS_AINES_CADETS')
  on conflict(promoteur_id) do update set date_expiration=current_date+30,statut='active',architecture_code='PARENTS_AINES_CADETS'
  returning id into v_session_b;

  insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut)
  values(v_promoteur,v_session_b,30000,current_date,current_date+30,'actif')
  on conflict(promoteur_id) do update set convention_id=excluded.convention_id,montant_mensuel=excluded.montant_mensuel,debut=current_date,echeance=current_date+30,statut='actif';

  -- L'architecture doit exister avant le lien Promoteur : le trigger provisionne les privilèges.
  insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses)
  values
    (v_a,'PARENTS_AINES_CADETS',v_promoteur,true,5,5),
    (v_b,'PARENTS_AINES_CADETS',v_promoteur,true,5,5)
  on conflict(pharmacie_id) do update set architecture_code=excluded.architecture_code,assigned_by=excluded.assigned_by,active=true;

  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values(v_promoteur,v_a,true),(v_promoteur,v_b,true)
  on conflict(promoteur_id,pharmacie_id) do update set actif=true;

  insert into public.profiles(id,role,actif,pharmacie_id,parent_profile_id,fonction_interne,niveau_interne,niveau_hierarchique,architecture_code)
  values(v_comptable,'pharmacie',true,v_a,v_promoteur,'comptable',2,2,'PARENTS_AINES_CADETS')
  on conflict(id) do update set role='pharmacie',actif=true,pharmacie_id=v_a,parent_profile_id=v_promoteur,fonction_interne='comptable',niveau_interne=2,niveau_hierarchique=2,architecture_code='PARENTS_AINES_CADETS';

  insert into public.naxa_profile_privileges(profile_id,privilege_code,pharmacie_id,scope_type,granted_by,active)
  values(v_comptable,'MANAGE_ACCOUNTING',v_a,'PHARMACIE',v_admin,true)
  on conflict(profile_id,privilege_code,pharmacie_id,scope_type)
  do update set active=true,revoked_at=null,granted_by=excluded.granted_by,granted_at=now();

  perform set_config('request.jwt.claim.sub',v_comptable::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_comptable::text,'role','authenticated')::text,true);

  if public.compta_scope_autorise(v_a) is not true then
    raise exception 'FAIL: Comptable should be authorized on assigned pharmacy A';
  end if;
  if public.compta_scope_autorise(v_b) is not false then
    raise exception 'FAIL: Comptable must be denied on pharmacy B';
  end if;

  v_session_a := public.comptable_service_demarrer('test isolation pharmacie A');
  if not exists(select 1 from public.comptable_service_sessions where id=v_session_a and pharmacie_id=v_a and comptable_id=v_comptable and ended_at is null) then
    raise exception 'FAIL: start RPC did not create the session in pharmacy A';
  end if;

  insert into public.comptable_service_sessions(id,pharmacie_id,comptable_id)
  values(v_session_b,v_b,v_comptable);

  begin
    perform public.comptable_service_terminer(v_session_b,'tentative hors périmètre');
    raise exception 'FAIL: end RPC accepted a session from pharmacy B';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  select ended_at into v_ended from public.comptable_service_sessions where id=v_session_b;
  if v_ended is not null then raise exception 'FAIL: foreign session B was modified'; end if;

  perform public.comptable_service_terminer(v_session_a,'fin test A');
  select ended_at into v_ended from public.comptable_service_sessions where id=v_session_a;
  if v_ended is null then raise exception 'FAIL: own session A was not closed'; end if;
end
$test$;

rollback;
select '267 Comptable — isolation inter-pharmacies PASS (transaction rollbackée)' as resultat;

-- NAXA 018c — délégation des privilèges Caisse par un Responsable N2.
-- Vérifie attribution/révocation nominatives et refus inter-pharmacies.
-- Toutes les fixtures sont annulées par ROLLBACK; exécution exclusivement sur Replay.

begin;
do $test$
declare
  v_actor uuid := '018c0000-0000-4000-8000-000000000001';
  v_admin uuid := '018c0000-0000-4000-8000-000000000002';
  v_promoteur uuid := '018c0000-0000-4000-8000-000000000003';
  v_caisse uuid := '018c0000-0000-4000-8000-000000000004';
  v_a uuid := '018c0000-0000-4000-8000-000000000101';
  v_b uuid := '018c0000-0000-4000-8000-000000000102';
  v_convention uuid;
begin
  set local session_replication_role=replica;
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  select '00000000-0000-0000-0000-000000000000',x,'authenticated','authenticated','naxa-test-'||x::text||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()
  from unnest(array[v_actor,v_admin,v_promoteur,v_caisse]) x on conflict(id) do nothing;
  set local session_replication_role=origin;

  insert into public.pharmacies(id,nom,ville,lat,lng,slug,est_demo,actif,visible_recherche)
  values(v_a,'NAXA Test 018c A','Yaoundé',3.8511,11.5051,'naxa-test-018c-a',false,true,true),
        (v_b,'NAXA Test 018c B','Yaoundé',3.8512,11.5052,'naxa-test-018c-b',false,true,true)
  on conflict(id) do nothing;
  insert into public.profiles(id,role,actif) values(v_admin,'admin',true)
  on conflict(id) do update set role='admin',actif=true;
  insert into public.profiles(id,role,actif,fonction_interne,niveau_interne,niveau_hierarchique,architecture_code)
  values(v_promoteur,'promoteur',true,'promoteur',1,1,'PARENTS_AINES_CADETS')
  on conflict(id) do update set role='promoteur',actif=true,fonction_interne='promoteur',niveau_interne=1,niveau_hierarchique=1,architecture_code='PARENTS_AINES_CADETS';
  insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut,architecture_code)
  values(v_promoteur,30000,current_date+30,'active','PARENTS_AINES_CADETS')
  on conflict(promoteur_id) do update set date_expiration=current_date+30,statut='active',architecture_code='PARENTS_AINES_CADETS'
  returning id into v_convention;
  insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut)
  values(v_promoteur,v_convention,30000,current_date,current_date+30,'actif')
  on conflict(promoteur_id) do update set convention_id=excluded.convention_id,montant_mensuel=excluded.montant_mensuel,debut=current_date,echeance=current_date+30,statut='actif';
  insert into public.profiles(id,role,actif,pharmacie_id,parent_profile_id,fonction_interne,niveau_interne,niveau_hierarchique,architecture_code)
  values(v_actor,'pharmacie',true,v_a,v_promoteur,'responsable',2,2,'PARENTS_AINES_CADETS')
  on conflict(id) do update set role='pharmacie',actif=true,pharmacie_id=v_a,parent_profile_id=v_promoteur,fonction_interne='responsable',niveau_interne=2,niveau_hierarchique=2,architecture_code='PARENTS_AINES_CADETS';
  insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses)
  values(v_a,'PARENTS_AINES_CADETS',v_promoteur,true,5,5),(v_b,'PARENTS_AINES_CADETS',v_promoteur,true,5,5)
  on conflict(pharmacie_id) do update set architecture_code=excluded.architecture_code,assigned_by=excluded.assigned_by,active=true;
  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values(v_promoteur,v_a,true),(v_promoteur,v_b,true)
  on conflict(promoteur_id,pharmacie_id) do update set actif=true;
  insert into public.naxa_profile_privileges(profile_id,privilege_code,pharmacie_id,scope_type,granted_by,active)
  values(v_actor,'VIEW_PRIVILEGES',v_a,'PHARMACIE',v_admin,true),
        (v_actor,'ASSIGN_PRIVILEGE',v_a,'PHARMACIE',v_admin,true),
        (v_actor,'REVOKE_PRIVILEGE',v_a,'PHARMACIE',v_admin,true),
        (v_actor,'CREATE_CAISSE',v_a,'PHARMACIE',v_admin,true)
  on conflict(profile_id,privilege_code,pharmacie_id,scope_type)
  do update set active=true,revoked_at=null,granted_by=excluded.granted_by,granted_at=now();
  insert into public.profiles(id,role,actif,fonction_interne,niveau_interne,niveau_hierarchique)
  values(v_caisse,'caisse',false,'caisse',3,3)
  on conflict(id) do update set role='caisse',actif=false,pharmacie_id=null,parent_profile_id=null,architecture_code=null;

  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_actor::text,'role','authenticated')::text,true);
  perform public.naxa_provision_caisse(v_caisse,v_a);

  if public.naxa_can('VIEW_PRIVILEGES',v_a,null) is not true
     or public.naxa_can('ASSIGN_PRIVILEGE',v_a,v_caisse) is not true
     or public.naxa_can('REVOKE_PRIVILEGE',v_a,v_caisse) is not true then
    raise exception 'Droits N2 de consultation/attribution/révocation refusés';
  end if;
  perform public.naxa_grant_privilege(v_caisse,'VIEW_SALES',v_a,'POSTE_CAISSE');
  if not exists(select 1 from public.naxa_profile_privileges where profile_id=v_caisse and privilege_code='VIEW_SALES' and pharmacie_id=v_a and scope_type='POSTE_CAISSE' and active) then
    raise exception 'Attribution nominative non persistée';
  end if;
  if public.naxa_can('ASSIGN_PRIVILEGE',v_b,v_caisse) is not false then
    raise exception 'Délégation inter-pharmacies autorisée à tort';
  end if;
  begin
    perform public.naxa_grant_privilege(v_caisse,'VIEW_SALES',v_b,'POSTE_CAISSE');
    raise exception 'Attribution inter-pharmacies non bloquée';
  exception when others then
    if sqlerrm='Attribution inter-pharmacies non bloquée' then raise; end if;
  end;
  perform public.naxa_revoke_privilege(v_caisse,'VIEW_SALES',v_a,'POSTE_CAISSE');
  if exists(select 1 from public.naxa_profile_privileges where profile_id=v_caisse and privilege_code='VIEW_SALES' and pharmacie_id=v_a and scope_type='POSTE_CAISSE' and active) then
    raise exception 'Révocation nominative non appliquée';
  end if;
end
$test$;
rollback;
select '018c Responsable — délégation privilèges Caisse PASS transactionnel' as resultat;

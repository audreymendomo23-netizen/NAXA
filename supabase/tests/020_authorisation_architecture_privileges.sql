-- NAXA 020 — acceptance test architecture + privilèges.
-- Fixture autonome, compatible avec Responsable = fonction_interne/niveau_interne.
-- Toutes les données sont rollbackées.

begin;

do $test$
declare
  v_admin uuid := '020a0000-0000-4000-8000-000000000001';
  v_promoteur uuid := '020a0000-0000-4000-8000-000000000002';
  v_target uuid := '020a0000-0000-4000-8000-000000000003';
  v_pharmacie uuid := '020a0000-0000-4000-8000-000000000101';
  v_hors_scope uuid := '020a0000-0000-4000-8000-000000000102';
  v_rejected boolean;
begin
  set local session_replication_role=replica;
  insert into auth.users(
    instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values
   ('00000000-0000-0000-0000-000000000000',v_admin,'authenticated','authenticated','naxa-test-020a-admin@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
   ('00000000-0000-0000-0000-000000000000',v_promoteur,'authenticated','authenticated','naxa-test-020a-promoteur@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
   ('00000000-0000-0000-0000-000000000000',v_target,'authenticated','authenticated','naxa-test-020a-target@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now())
  on conflict(id) do nothing;
  set local session_replication_role=origin;

  insert into public.pharmacies(id,nom,ville,lat,lng,slug,est_demo,actif)
  values
    (v_pharmacie,'NAXA Test 020A','Yaoundé',3.8521,11.5061,'naxa-test-020a',false,true),
    (v_hors_scope,'NAXA Test 020A hors scope','Yaoundé',3.8522,11.5062,'naxa-test-020a-out',false,true)
  on conflict(id) do nothing;

  insert into public.profiles(id,role,actif)
  values(v_admin,'admin',true)
  on conflict(id) do update set role='admin',actif=true;

  insert into public.profiles(id,role,actif,fonction_interne,niveau_interne,niveau_hierarchique,architecture_code)
  values(v_promoteur,'promoteur',true,'promoteur',1,1,'PARENTS_ENFANTS')
  on conflict(id) do update set role='promoteur',actif=true,fonction_interne='promoteur',niveau_interne=1,niveau_hierarchique=1,architecture_code='PARENTS_ENFANTS';

  insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut,architecture_code)
  values(v_promoteur,30000,current_date+30,'active','PARENTS_ENFANTS')
  on conflict(promoteur_id) do update set architecture_code='PARENTS_ENFANTS',statut='active',date_expiration=current_date+30;

  insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut)
  select v_promoteur,c.id,30000,current_date,current_date+30,'actif'
  from public.conventions_promoteurs c where c.promoteur_id=v_promoteur
  on conflict(promoteur_id) do update set convention_id=excluded.convention_id,montant_mensuel=30000,debut=current_date,echeance=current_date+30,statut='actif';

  insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,max_responsables,max_caisses,active)
  values(v_pharmacie,'PARENTS_ENFANTS',v_admin,0,5,true)
  on conflict(pharmacie_id) do update set architecture_code='PARENTS_ENFANTS',assigned_by=v_admin,max_responsables=0,max_caisses=5,active=true;

  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values(v_promoteur,v_pharmacie,true)
  on conflict(promoteur_id,pharmacie_id) do update set actif=true;

  insert into public.profiles(id,role,actif,pharmacie_id,parent_profile_id,fonction_interne,niveau_interne,niveau_hierarchique,architecture_code)
  values(v_target,'pharmacie',true,v_pharmacie,v_promoteur,'responsable',2,2,'PARENTS_ENFANTS')
  on conflict(id) do update set role='pharmacie',actif=true,pharmacie_id=v_pharmacie,parent_profile_id=v_promoteur,fonction_interne='responsable',niveau_interne=2,niveau_hierarchique=2,architecture_code='PARENTS_ENFANTS';

  insert into public.naxa_profile_privileges(profile_id,privilege_code,pharmacie_id,scope_type,granted_by,active)
  values
   (v_promoteur,'ASSIGN_PRIVILEGE',v_pharmacie,'PHARMACIE',v_admin,true),
   (v_promoteur,'CREATE_RESPONSABLE',v_pharmacie,'PHARMACIE',v_admin,true),
   (v_promoteur,'CREATE_CAISSE',v_pharmacie,'PHARMACIE',v_admin,true),
   (v_promoteur,'VIEW_STOCK',v_pharmacie,'PHARMACIE',v_admin,true),
   (v_promoteur,'VIEW_PURCHASE_COST',v_pharmacie,'PHARMACIE',v_admin,true)
  on conflict(profile_id,privilege_code,pharmacie_id,scope_type)
  do update set active=true,revoked_at=null,granted_by=excluded.granted_by,granted_at=now();

  perform set_config('request.jwt.claim.sub',v_promoteur::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_promoteur::text,'role','authenticated')::text,true);

  -- Architecture A2 doit refuser le niveau Responsable (l'assertion ne capture pas son propre échec).
  v_rejected:=false;
  begin
    perform public.accrediter_profile(v_target,v_pharmacie,2::smallint,v_promoteur);
  exception when others then
    v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Architecture PARENTS_ENFANTS doit refuser le niveau Responsable'; end if;

  update public.profiles set role='caisse',fonction_interne='caisse',niveau_interne=3,niveau_hierarchique=3,parent_profile_id=null,pharmacie_id=v_pharmacie,actif=true where id=v_target;
  perform public.accrediter_profile(v_target,v_pharmacie,3::smallint,v_promoteur);
  perform public.naxa_grant_privilege(v_target,'VIEW_STOCK',v_pharmacie,'POSTE_CAISSE');

  perform set_config('request.jwt.claim.sub',v_target::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_target::text,'role','authenticated')::text,true);
  if not public.authorize('VIEW_STOCK',v_pharmacie,'POSTE_CAISSE') then raise exception 'Caisse doit obtenir VIEW_STOCK dans son scope'; end if;
  if public.authorize('VIEW_PURCHASE_COST',v_pharmacie,'POSTE_CAISSE') then raise exception 'Caisse ne doit pas obtenir automatiquement VIEW_PURCHASE_COST'; end if;
  if public.authorize('MANAGE_CONVENTION',v_pharmacie,'PHARMACIE') then raise exception 'Gouvernance convention doit rester NAXA'; end if;

  update public.conventions_promoteurs set architecture_code='PARENTS_AINES_CADETS' where promoteur_id=v_promoteur;
  update public.pharmacie_architectures set architecture_code='PARENTS_AINES_CADETS',max_responsables=5,max_caisses=5,assigned_by=v_admin,active=true where pharmacie_id=v_pharmacie;
  update public.profiles set role='pharmacie',fonction_interne='responsable',niveau_interne=2,niveau_hierarchique=2,parent_profile_id=null,pharmacie_id=v_pharmacie,actif=true where id=v_target;
  perform set_config('request.jwt.claim.sub',v_promoteur::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_promoteur::text,'role','authenticated')::text,true);
  perform public.accrediter_profile(v_target,v_pharmacie,2::smallint,v_promoteur);
  perform public.naxa_grant_privilege(v_target,'VIEW_RESPONSABLE_PILOTAGE',v_pharmacie,'PHARMACIE');

  if (select niveau_interne from public.profiles where id=v_target) <> 2 then raise exception 'Responsable attendu au niveau interne 2'; end if;
  if (select role::text from public.profiles where id=v_target) <> 'pharmacie' then raise exception 'Responsable doit rester une fonction interne, pas un role_type'; end if;

  perform set_config('request.jwt.claim.sub',v_target::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_target::text,'role','authenticated')::text,true);
  if public.authorize('VIEW_NETWORK_PILOTAGE',v_pharmacie,'PHARMACIE') then raise exception 'Responsable ne doit pas recevoir VIEW_NETWORK_PILOTAGE'; end if;
  if not public.authorize('VIEW_RESPONSABLE_PILOTAGE',v_pharmacie,'PHARMACIE') then raise exception 'Responsable doit obtenir le pilotage de sa pharmacie'; end if;
  if public.authorize('VIEW_RESPONSABLE_PILOTAGE',v_hors_scope,'PHARMACIE') then raise exception 'Scope Responsable hors pharmacie autorisée'; end if;
end
$test$;

rollback;

select '020_authorisation_architecture_privileges PASS' as resultat;

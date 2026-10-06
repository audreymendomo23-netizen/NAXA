-- NAXA Partie 3/6 — comportemental isolé CI.
begin;
create temp table p3_ids(promoteur uuid, pharmacie uuid, target uuid, other_pharmacie uuid);
do $$
declare v_promoteur uuid := gen_random_uuid(); v_target uuid := gen_random_uuid(); v_pharmacie uuid := gen_random_uuid(); v_other_pharmacie uuid := gen_random_uuid();
begin
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
   (v_promoteur,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','p3-promoteur@example.test','x',now(),'{"provider":"email","providers":["email"]}','{"username":"p3promoteur","first_name":"P3","last_name":"Promoteur","date_of_birth":"1990-01-01","consent_accepted":true,"phone_country":"CM","phone":"+237690000001"}',now(),now()),
   (v_target,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','p3-target@example.test','x',now(),'{"provider":"email","providers":["email"]}','{"username":"p3target","first_name":"P3","last_name":"Target","date_of_birth":"1990-01-01","consent_accepted":true,"phone_country":"CM","phone":"+237690000002"}',now(),now());
  insert into public.pharmacies(id,nom,actif) values(v_pharmacie,'P3 Test A3',true),(v_other_pharmacie,'P3 Test Hors périmètre',true);
  update public.profiles set role='promoteur',fonction_interne='promoteur',niveau_interne=1,actif=true where id=v_promoteur;
  update public.profiles set role='pharmacie',fonction_interne='responsable',actif=true where id=v_target;
  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(v_promoteur,v_pharmacie,true);
  insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut,architecture_code) values(v_promoteur,30000,current_date+30,'active','PARENTS_AINES_CADETS');
  insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut)
  select c.promoteur_id,c.id,c.montant_mensuel,current_date,current_date+30,'actif' from public.conventions_promoteurs c where c.promoteur_id=v_promoteur;
  insert into public.pharmacie_architectures(pharmacie_id,architecture_code,active) values(v_pharmacie,'PARENTS_AINES_CADETS',true);
  insert into public.naxa_profile_privileges(profile_id,privilege_code,pharmacie_id,scope_type,granted_by)
  values(v_promoteur,'CREATE_RESPONSABLE',v_pharmacie,'PHARMACIE',v_promoteur);
  insert into p3_ids values(v_promoteur,v_pharmacie,v_target,v_other_pharmacie);
end $$;
create or replace function pg_temp.assert_raises(p_sql text,p_label text) returns void language plpgsql as $$
begin begin execute p_sql; exception when others then return; end; raise exception 'FAIL: % — aucune exception',p_label; end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select promoteur::text from p3_ids),true);
select set_config('request.jwt.claims',json_build_object('sub',(select promoteur::text from p3_ids),'role','authenticated')::text,true);
select pg_temp.assert_true((select public.naxa_promoteur_valide((select promoteur from p3_ids))),'Promoteur A3 valide');
select pg_temp.assert_true((select public.naxa_has_privilege('CREATE_RESPONSABLE',(select pharmacie from p3_ids),'PHARMACIE')),'CREATE_RESPONSABLE autorisé');
do $$
declare v_id uuid;
begin
  v_id:=public.accrediter_responsable((select target from p3_ids),(select pharmacie from p3_ids));
  if v_id is null then raise exception 'FAIL: ID accreditation null'; end if;
end $$;
select pg_temp.assert_true((select p.fonction_interne='responsable' and p.niveau_interne=2 and p.pharmacie_id=(select pharmacie from p3_ids) from public.profiles p where p.id=(select target from p3_ids)),'Responsable correctement accrédité');
select pg_temp.assert_true(not public.naxa_has_privilege('CREATE_RESPONSABLE',(select other_pharmacie from p3_ids),'PHARMACIE'),'Hors périmètre refusé');
select pg_temp.assert_raises(format('select public.accrediter_responsable(%L,%L)',(select target from p3_ids),(select other_pharmacie from p3_ids)),'Accréditation hors périmètre refusée');
update public.naxa_profile_privileges set active=false,revoked_at=now() where profile_id=(select promoteur from p3_ids) and privilege_code='CREATE_RESPONSABLE' and pharmacie_id=(select pharmacie from p3_ids);
select pg_temp.assert_true(not public.naxa_has_privilege('CREATE_RESPONSABLE',(select pharmacie from p3_ids),'PHARMACIE'),'Révocation CREATE_RESPONSABLE effective');
do $$
declare v_target uuid:=gen_random_uuid();
begin
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(v_target,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','p3-target2@example.test','x',now(),'{"provider":"email","providers":["email"]}','{"username":"p3target2","first_name":"P3","last_name":"Target2","date_of_birth":"1990-01-01","consent_accepted":true}',now(),now());
  update public.profiles set role='pharmacie',fonction_interne='responsable',actif=true where id=v_target;
  perform pg_temp.assert_raises(format('select public.accrediter_profile(%L,%L,2,%L)',v_target,(select pharmacie from p3_ids),(select promoteur from p3_ids)),'API historique sans CREATE_RESPONSABLE refusée');
end $$;
update public.conventions_promoteurs set date_expiration=current_date-1,statut='expiree' where promoteur_id=(select promoteur from p3_ids);
update public.abonnements_promoteurs set echeance=current_date-1,statut='impaye' where promoteur_id=(select promoteur from p3_ids);
select pg_temp.assert_true(not public.naxa_promoteur_valide((select promoteur from p3_ids)),'Expiration commerciale bloquante');
update public.conventions_promoteurs set date_expiration=current_date+30,statut='active',architecture_code='ORPHELIN' where promoteur_id=(select promoteur from p3_ids);
update public.abonnements_promoteurs set echeance=current_date+30,statut='actif' where promoteur_id=(select promoteur from p3_ids);
update public.naxa_profile_privileges set active=true,revoked_at=null where profile_id=(select promoteur from p3_ids) and privilege_code='CREATE_RESPONSABLE';
select pg_temp.assert_true(not exists(select 1 from public.naxa_architecture_privileges where architecture_code='ORPHELIN' and role_key='promoteur' and privilege_code='CREATE_RESPONSABLE'),'A1 sans CREATE_RESPONSABLE');
select pg_temp.assert_raises(format('select public.accrediter_responsable(%L,%L)',(select target from p3_ids),(select pharmacie from p3_ids)),'A1 Responsable refusé');
update public.conventions_promoteurs set architecture_code='PARENTS_ENFANTS' where promoteur_id=(select promoteur from p3_ids);
select pg_temp.assert_true(not exists(select 1 from public.naxa_architecture_privileges where architecture_code='PARENTS_ENFANTS' and role_key='promoteur' and privilege_code='CREATE_RESPONSABLE'),'A2 sans CREATE_RESPONSABLE');
select pg_temp.assert_raises(format('select public.accrediter_responsable(%L,%L)',(select target from p3_ids),(select promoteur from p3_ids)),'A2 Responsable refusé');
rollback;
select 'Partie 3 behavioral suite' as suite,true as pass;

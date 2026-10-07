-- NAXA Partie 4 — vérifications 5+6 : anti-élévation et cohérence après suspension/expiration.
begin;

create temp table p4c_ids(promoteur uuid, pharmacie uuid, caisse uuid, responsable uuid, convention uuid);

do $$
declare
  p uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); r uuid:=gen_random_uuid(); conv uuid;
begin
  set local session_replication_role='replica';
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
   (p,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','p4c-p@example.test','x',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
   (c,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','p4c-c@example.test','x',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
   (r,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','p4c-r@example.test','x',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
  insert into public.profiles(id,role,username,first_name,last_name,phone,phone_country,date_of_birth,age_verified,consent_accepted_at,actif,fonction_interne,niveau_interne,niveau_hierarchique)
  values
   (p,'promoteur','p4cp','P4','Promoteur','+237690000031','CM','1990-01-01',true,now(),true,'promoteur',1,1),
   (c,'caisse','p4cc','P4','Caisse','+237690000032','CM','1990-01-01',true,now(),true,'caisse',3,3),
   (r,'pharmacie','p4cr','P4','Responsable','+237690000033','CM','1990-01-01',true,now(),true,'responsable',2,2);
  set local session_replication_role='origin';

  insert into public.pharmacies(id,nom,lat,lng,actif) values(a,'P4C A',3.8667,11.5167,true);
  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(p,a,true);
  insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut,architecture_code)
  values(p,30000,current_date+30,'active','PARENTS_AINES_CADETS') returning id into conv;
  insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut)
  values(p,conv,30000,current_date,current_date+30,'actif');
  insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses)
  values(a,'PARENTS_AINES_CADETS',p,true,5,5);
  update public.profiles set pharmacie_id=a,parent_profile_id=p,architecture_code='PARENTS_AINES_CADETS' where id in(c,r);
  insert into p4c_ids values(p,a,c,r,conv);
end $$;

create or replace function pg_temp.assert_true(p_ok boolean,p_label text) returns void language plpgsql as $fn$
begin if not p_ok then raise exception 'FAIL: %',p_label; end if; end $fn$;
create or replace function pg_temp.assert_raises(p_sql text,p_label text) returns void language plpgsql as $fn$
begin begin execute p_sql; exception when others then return; end; raise exception 'FAIL: % — aucune exception',p_label; end $fn$;
grant select on p4c_ids to authenticated;

-- 5. Une Caisse ne peut pas s'auto-élever ni gérer la hiérarchie.
set local role authenticated;
select set_config('request.jwt.claim.sub',(select caisse::text from p4c_ids),true);
select set_config('request.jwt.claims',json_build_object('sub',(select caisse::text from p4c_ids),'role','authenticated')::text,true);

select pg_temp.assert_true(
  not public.naxa_can('ASSIGN_PRIVILEGE',(select pharmacie::text::uuid from p4c_ids),null),
  '5.1 Caisse sans capacité d attribution'
);
select pg_temp.assert_raises(
  format('select public.naxa_grant_privilege(%L,%L,%L,%L)',(select caisse from p4c_ids),'VIEW_STOCK',(select pharmacie from p4c_ids),'POSTE_CAISSE'),
  '5.2 Caisse ne peut pas s auto-attribuer'
);
select pg_temp.assert_raises(
  format('select public.accrediter_profile(%L,%L,3,%L)',(select caisse from p4c_ids),(select pharmacie from p4c_ids),(select caisse from p4c_ids)),
  '5.3 Caisse ne peut pas accréditer une autre Caisse'
);

-- 6. Après expiration, le Promoteur ne peut plus déléguer.
set local role authenticated;
select set_config('request.jwt.claim.sub',(select promoteur::text from p4c_ids),true);
select set_config('request.jwt.claims',json_build_object('sub',(select promoteur::text from p4c_ids),'role','authenticated')::text,true);

select public.naxa_grant_privilege((select caisse from p4c_ids),'VIEW_STOCK',(select pharmacie from p4c_ids),'PHARMACIE');
select public.naxa_set_caisse_status((select caisse from p4c_ids),false);
select pg_temp.assert_raises(
  format('select public.naxa_grant_privilege(%L,%L,%L,%L)',(select caisse from p4c_ids),'VIEW_STOCK',(select pharmacie from p4c_ids),'PHARMACIE'),
  '6.1 cible inactive non délégable'
);
select public.naxa_set_caisse_status((select caisse from p4c_ids),true);
update public.conventions_promoteurs set date_expiration=current_date-1,statut='expiree' where id=(select convention from p4c_ids);
update public.abonnements_promoteurs set echeance=current_date-1,statut='impaye' where promoteur_id=(select promoteur from p4c_ids);
select pg_temp.assert_true(
  not public.naxa_promoteur_valide((select promoteur from p4c_ids)),
  '6.2 expiration commerciale effective'
);
select pg_temp.assert_raises(
  format('select public.naxa_grant_privilege(%L,%L,%L,%L)',(select caisse from p4c_ids),'VIEW_STOCK',(select pharmacie from p4c_ids),'PHARMACIE'),
  '6.3 Promoteur expiré ne peut plus déléguer'
);

select pg_temp.assert_raises(
  format('select public.naxa_set_caisse_status(%L,false)',(select caisse from p4c_ids)),
  '6.4 Promoteur expiré ne peut plus suspendre une Caisse'
);

rollback;
select 'Partie 4 — vérifications 5+6' as suite, true as pass;

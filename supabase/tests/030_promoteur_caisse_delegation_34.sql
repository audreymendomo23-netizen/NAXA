-- NAXA Partie 4 — vérifications 3+4 : délégation, non-délégabilité, scope et architecture.
begin;

create temp table p4b_ids(promoteur uuid, pharmacie_a uuid, pharmacie_b uuid, caisse uuid, responsable uuid);

do $$
declare
  p uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
  c uuid:=gen_random_uuid(); r uuid:=gen_random_uuid(); conv uuid;
begin
  set local session_replication_role='replica';
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
   (p,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','p4b-p@example.test','x',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
   (c,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','p4b-c@example.test','x',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
   (r,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','p4b-r@example.test','x',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
  insert into public.profiles(id,role,username,first_name,last_name,phone,phone_country,date_of_birth,age_verified,consent_accepted_at,actif,fonction_interne,niveau_interne,niveau_hierarchique)
  values
   (p,'promoteur','p4bp','P4','Promoteur','+237690000021','CM','1990-01-01',true,now(),true,'promoteur',1,1),
   (c,'caisse','p4bc','P4','Caisse','+237690000022','CM','1990-01-01',true,now(),true,'caisse',3,3),
   (r,'pharmacie','p4br','P4','Responsable','+237690000023','CM','1990-01-01',true,now(),true,'responsable',2,2);
  set local session_replication_role='origin';

  insert into public.pharmacies(id,nom,lat,lng,actif)
  values(a,'P4B A',3.8667,11.5167,true),(b,'P4B B',3.8700,11.5200,true);
  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(p,a,true);
  insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut,architecture_code)
  values(p,30000,current_date+30,'active','PARENTS_AINES_CADETS') returning id into conv;
  insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut)
  values(p,conv,30000,current_date,current_date+30,'actif');
  insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses)
  values(a,'PARENTS_AINES_CADETS',p,true,5,5),(b,'PARENTS_AINES_CADETS',p,true,5,5);
  update public.profiles set pharmacie_id=a,parent_profile_id=p,architecture_code='PARENTS_AINES_CADETS' where id in(c,r);
  insert into p4b_ids values(p,a,b,c,r);
end $$;

create or replace function pg_temp.assert_true(p_ok boolean,p_label text) returns void language plpgsql as $fn$
begin if not p_ok then raise exception 'FAIL: %',p_label; end if; end $fn$;
create or replace function pg_temp.assert_raises(p_sql text,p_label text) returns void language plpgsql as $fn$
begin begin execute p_sql; exception when others then return; end; raise exception 'FAIL: % — aucune exception',p_label; end $fn$;
grant select on p4b_ids to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select promoteur::text from p4b_ids),true);
select set_config('request.jwt.claims',json_build_object('sub',(select promoteur::text from p4b_ids),'role','authenticated')::text,true);

-- 3. Délégation compatible dans le scope autorisé.
select pg_temp.assert_true(
  public.naxa_can('ASSIGN_PRIVILEGE',(select pharmacie_a from p4b_ids),(select caisse from p4b_ids)),
  '3.1 attribution de privilège autorisée'
);
select public.naxa_grant_privilege((select caisse from p4b_ids),'VIEW_STOCK',(select pharmacie_a from p4b_ids),'PHARMACIE');
select pg_temp.assert_true(
  exists(
    select 1 from public.naxa_profile_privileges
    where profile_id=(select caisse from p4b_ids)
      and privilege_code='VIEW_STOCK'
      and pharmacie_id=(select pharmacie_a from p4b_ids)
      and scope_type='PHARMACIE'
      and active
  ),
  '3.2 privilège opérationnel attribué à la Caisse'
);

-- 4. Privilèges gouvernance, architecture et scopes incompatibles refusés.
select pg_temp.assert_raises(
  format('select public.naxa_grant_privilege(%L,%L,%L,%L)',(select caisse from p4b_ids),'CHANGE_ARCHITECTURE',(select pharmacie_a from p4b_ids),'PHARMACIE'),
  '4.1 gouvernance NAXA non délégable'
);
select pg_temp.assert_raises(
  format('select public.naxa_grant_privilege(%L,%L,%L,%L)',(select caisse from p4b_ids),'VIEW_NETWORK_PILOTAGE',(select pharmacie_a from p4b_ids),'RESEAU'),
  '4.2 scope réseau interdit à une Caisse'
);
select pg_temp.assert_raises(
  format('select public.naxa_grant_privilege(%L,%L,%L,%L)',(select caisse from p4b_ids),'VIEW_STOCK',(select pharmacie_b from p4b_ids),'PHARMACIE'),
  '4.3 pharmacie hors réseau refusée'
);

-- Une attribution au Responsable de la même pharmacie reste possible si elle est autorisée.
select public.naxa_grant_privilege((select responsable from p4b_ids),'VIEW_STOCK',(select pharmacie_a from p4b_ids),'PHARMACIE');
select pg_temp.assert_true(
  public.naxa_has_privilege('VIEW_STOCK',(select pharmacie_a from p4b_ids),'PHARMACIE'),
  '4.4 privilège compatible au Responsable'
);

-- Révocation dans le même périmètre.
select public.naxa_revoke_privilege((select caisse from p4b_ids),'VIEW_STOCK',(select pharmacie_a from p4b_ids),'PHARMACIE');
select pg_temp.assert_true(
  not exists(
    select 1 from public.naxa_profile_privileges
    where profile_id=(select caisse from p4b_ids)
      and privilege_code='VIEW_STOCK'
      and pharmacie_id=(select pharmacie_a from p4b_ids)
      and scope_type='PHARMACIE'
      and active
  ),
  '4.5 révocation effective'
);

-- Le même Promoteur ne peut ni attribuer ni révoquer un privilège sur
-- un membre qui n'est plus son descendant direct.
select public.naxa_grant_privilege((select caisse from p4b_ids),'VIEW_STOCK',(select pharmacie_a from p4b_ids),'PHARMACIE');
update public.profiles
set parent_profile_id=(select responsable from p4b_ids)
where id=(select caisse from p4b_ids);

select pg_temp.assert_raises(
  format('select public.naxa_revoke_privilege(%L,%L,%L,%L)',(select caisse from p4b_ids),'VIEW_STOCK',(select pharmacie_a from p4b_ids),'PHARMACIE'),
  '4.6 révocation hors descendant direct refusée'
);

rollback;
select 'Partie 4 — vérifications 3+4' as suite, true as pass;

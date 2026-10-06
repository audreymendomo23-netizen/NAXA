-- NAXA Partie 4 — vérifications 1+2 : management Caisse, scope, architecture, quotas.
-- Checkpoint d'exécution : 6 octobre 2026.
begin;

create temp table p4_ids(
  promoteur uuid,
  pharmacie_a uuid,
  pharmacie_b uuid,
  caisse1 uuid,
  caisse2 uuid,
  responsable uuid
);

do $$
declare
  p uuid:=gen_random_uuid();
  a uuid:=gen_random_uuid();
  b uuid:=gen_random_uuid();
  c1 uuid:=gen_random_uuid();
  c2 uuid:=gen_random_uuid();
  r uuid:=gen_random_uuid();
  conv uuid;
begin
  set local session_replication_role='replica';
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
   (p,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','p4-promoteur@example.test','x',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
   (c1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','p4-c1@example.test','x',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
   (c2,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','p4-c2@example.test','x',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
   (r,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','p4-r@example.test','x',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
  insert into public.profiles(id,role,username,first_name,last_name,phone,phone_country,date_of_birth,age_verified,consent_accepted_at,actif,fonction_interne,niveau_interne,niveau_hierarchique)
  values
   (p,'promoteur','p4promoteur','P4','Promoteur','+237690000011','CM','1990-01-01',true,now(),true,'promoteur',1,1),
   (c1,'caisse','p4caisse1','P4','Caisse1','+237690000012','CM','1990-01-01',true,now(),true,'caisse',3,3),
   (c2,'caisse','p4caisse2','P4','Caisse2','+237690000013','CM','1990-01-01',true,now(),false,'caisse',3,3),
   (r,'pharmacie','p4responsable','P4','Responsable','+237690000014','CM','1990-01-01',true,now(),true,'responsable',2,2);
  set local session_replication_role='origin';

  insert into public.pharmacies(id,nom,lat,lng,actif) values(a,'P4 A',3.8667,11.5167,true),(b,'P4 B',3.8700,11.5200,true);
  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(p,a,true);
  insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses)
  values(a,'ORPHELIN',p,true,0,1),(b,'ORPHELIN',p,true,0,1);
  insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut,architecture_code)
  values(p,30000,current_date+30,'active','ORPHELIN')
  returning id into conv;
  insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut)
  values(p,conv,30000,current_date,current_date+30,'actif');

  update public.profiles set pharmacie_id=a,parent_profile_id=p,architecture_code='ORPHELIN' where id=c1;
  update public.profiles set pharmacie_id=a,parent_profile_id=p,architecture_code='ORPHELIN' where id=c2;
  update public.profiles set pharmacie_id=a,parent_profile_id=p,architecture_code='ORPHELIN' where id=r;
  insert into p4_ids values(p,a,b,c1,c2,r);
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select promoteur::text from p4_ids),true);
select set_config('request.jwt.claims',json_build_object('sub',(select promoteur::text from p4_ids),'role','authenticated')::text,true);

-- 1. Scope réseau/pharmacie : A autorisée, B refusée.
select pg_temp.assert_true(
  public.naxa_scope_allows((select promoteur from p4_ids),(select pharmacie_a from p4_ids),'PHARMACIE'),
  '1.1 Promoteur autorisé dans sa pharmacie'
);
select pg_temp.assert_true(
  not public.naxa_scope_allows((select promoteur from p4_ids),(select pharmacie_b from p4_ids),'PHARMACIE'),
  '1.2 Promoteur refusé hors réseau'
);

-- 2. Création/provisionnement : architecture + cible + quota.
select pg_temp.assert_true(
  public.naxa_can('CREATE_CAISSE',(select pharmacie_a from p4_ids),null),
  '2.1 CREATE_CAISSE autorisé par architecture A1'
);

select pg_temp.assert_raises(
  format('select public.naxa_provision_caisse(%L,%L)',(select caisse2 from p4_ids),(select pharmacie_b from p4_ids)),
  '2.2 provisionnement hors réseau refusé'
);

select pg_temp.assert_raises(
  format('select public.naxa_provision_caisse(%L,%L)',(select responsable from p4_ids),(select pharmacie_a from p4_ids)),
  '2.3 cible non-Caisse refusée'
);

select pg_temp.assert_raises(
  format('select public.naxa_provision_caisse(%L,%L)',(select caisse2 from p4_ids),(select pharmacie_a from p4_ids)),
  '2.4 quota Caisse A1 atteint'
);

-- 2.5 Après suspension de la Caisse active, la seconde Caisse peut être provisionnée.
select pg_temp.assert_true(
  public.naxa_can('SUSPEND_CAISSE',(select pharmacie_a from p4_ids),(select caisse1 from p4_ids)),
  '2.5a droit de suspension disponible'
);
select public.naxa_set_caisse_status((select caisse1 from p4_ids),false);
select pg_temp.assert_true(
  not exists(select 1 from public.profiles where id=(select caisse1 from p4_ids) and actif),
  '2.5b suspension effective'
);
select public.naxa_provision_caisse((select caisse2 from p4_ids),(select pharmacie_a from p4_ids));
select pg_temp.assert_true(
  exists(select 1 from public.profiles where id=(select caisse2 from p4_ids) and actif and pharmacie_id=(select pharmacie_a from p4_ids) and parent_profile_id=(select promoteur from p4_ids)),
  '2.5c provisionnement Caisse direct effectif'
);

-- 2.6 La réactivation respecte à nouveau le quota.
select pg_temp.assert_raises(
  format('select public.naxa_set_caisse_status(%L,true)',(select caisse1 from p4_ids)),
  '2.6 réactivation bloquée par quota'
);

-- 2.7 Le Promoteur ne peut pas suspendre/réactiver une Caisse hors de son réseau.
update public.profiles set pharmacie_id=(select pharmacie_b from p4_ids) where id=(select caisse1 from p4_ids);
select pg_temp.assert_raises(
  format('select public.naxa_set_caisse_status(%L,false)',(select caisse1 from p4_ids)),
  '2.7 suspension hors réseau refusée'
);

rollback;
select 'Partie 4 — vérifications 1+2' as suite, true as pass;

-- NAXA 154 — parcours transactionnel de réactivation Promoteur par un admin.
begin;
do $test$
declare
  p uuid:=gen_random_uuid();
  admin_id uuid:=gen_random_uuid();
  ph uuid:=gen_random_uuid();
  conv uuid;
  fin date;
  v_fin date;
begin
  perform set_config('session_replication_role','replica',true);
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
   (p,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa-154-promoteur@example.test','x',now(),'{}','{}',now(),now()),
   (admin_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa-154-admin@example.test','x',now(),'{}','{}',now(),now());
  insert into public.profiles(id,role,username,first_name,last_name,phone,phone_country,date_of_birth,age_verified,consent_accepted_at,actif,fonction_interne,niveau_interne,niveau_hierarchique,architecture_code)
  values
   (p,'promoteur','naxa154p','Test','Promoteur','237690000154','CM','1990-01-01',true,now(),true,'promoteur',1,1,'PARENTS_AINES_CADETS'),
   (admin_id,'admin','naxa154a','Test','Admin','237690000155','CM','1980-01-01',true,now(),true,'admin',0,0,null);
  perform set_config('session_replication_role','origin',true);

  insert into public.pharmacies(id,nom,lat,lng,actif) values(ph,'NAXA 154 test',3.86,11.51,false);
  insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut,architecture_code)
  values(p,25000,current_date-1,'expiree','PARENTS_AINES_CADETS')
  returning id into conv;
  insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut)
  values(p,conv,25000,current_date-30,current_date-1,'impaye');
  insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses)
  values(ph,'PARENTS_AINES_CADETS',admin_id,true,5,5);
  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(p,ph,true);

  update public.profiles set actif=false where id=p;
  update public.pharmacies set actif=false where id=ph;

  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',admin_id::text,'role','authenticated')::text,true);
  v_fin:=public.reactiver_promoteur(p,'NAXA-TEST-154');

  if v_fin<>current_date+interval '1 month'-interval '1 day' then
    raise exception '154.1 : échéance de réactivation incorrecte';
  end if;
  if not public.naxa_promoteur_valide(p) then
    raise exception '154.2 : le Promoteur doit être valide après réactivation';
  end if;
  if not exists(select 1 from public.abonnements_promoteurs where promoteur_id=p and statut='actif' and echeance=v_fin) then
    raise exception '154.3 : abonnement non réactivé';
  end if;
  if not exists(select 1 from public.abonnement_promoteur_paiements where reference='NAXA-TEST-154' and abonnement_id=(select id from public.abonnements_promoteurs where promoteur_id=p)) then
    raise exception '154.4 : trace de paiement de réactivation absente';
  end if;
  if not exists(select 1 from public.pharmacies where id=ph and actif=true) then
    raise exception '154.5 : pharmacie non réactivée';
  end if;
end
$test$;
rollback;
select 'Vérification 154 — réactivation Promoteur : PASS transactionnel' as resultat;

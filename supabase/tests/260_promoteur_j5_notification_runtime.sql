-- NAXA 260 — runtime du rappel J−5 : identité Promoteur/pharmacies et anti-doublon.
-- Base de test uniquement; toutes les fixtures/notifications sont annulées.
begin;
do $reminder$
declare
 p uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); ph uuid:=gen_random_uuid();
 v_conv uuid; v_due date:=(now() at time zone 'Africa/Douala')::date+5;
 v_count integer; v_second integer; v_msg text; v_admin_msg text;
begin
 set local session_replication_role='replica';
 insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values
 (p,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa-j5-p-'||replace(p::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
 (a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa-j5-a-'||replace(a::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());
 set local session_replication_role='origin';
 insert into public.profiles(id,role,first_name,last_name,actif,age_verified,consent_accepted_at,niveau_interne)
 values(p,'promoteur','Test','Promoteur',true,true,now(),1),(a,'admin','Test','Admin',true,true,now(),1);
 insert into public.pharmacies(id,nom,ville,lat,lng,actif,visible_recherche)
 values(ph,'Pharmacie test J5','Yaoundé',3.87,11.52,true,true);
 insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut,architecture_code)
 values(p,30000,v_due,'active','PARENTS_AINES_CADETS') returning id into v_conv;
 insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut)
 values(p,v_conv,30000,current_date-25,v_due,'actif');
 insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses)
 values(ph,'PARENTS_AINES_CADETS',p,true,5,5);
 insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(p,ph,true);

 select public.generer_rappels_echeance_promoteurs() into v_count;
 if v_count<>1 then raise exception 'Expected one J-5 reminder, got %',v_count; end if;
 select corps into v_msg from public.notifications where user_id=p and type='abonnement_echeance_5j' order by created_at desc limit 1;
 select corps into v_admin_msg from public.notifications where user_id=a and type='abonnement_echeance_5j_admin' order by created_at desc limit 1;
 if v_msg is null or position('Test Promoteur' in v_msg)=0 or position('Pharmacie test J5' in v_msg)=0 then raise exception 'Promoter notification missing identity/pharmacy'; end if;
 if v_admin_msg is null or position('Test Promoteur' in v_admin_msg)=0 or position('Pharmacie test J5' in v_admin_msg)=0 then raise exception 'Admin notification missing identity/pharmacy'; end if;
 select public.generer_rappels_echeance_promoteurs() into v_second;
 if v_second<>0 then raise exception 'Reminder duplicate guard failed: second count %',v_second; end if;
end
$reminder$;
rollback;
select '260_promoteur_j5_notification_runtime PASS (transaction rolled back)' as resultat;

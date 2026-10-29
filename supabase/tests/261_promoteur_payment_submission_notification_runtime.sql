-- NAXA 261 — runtime de la soumission de règlement : notification Admin avec Promoteur et pharmacies.
-- Base de test uniquement; fixtures, règlement et notifications sont annulés.
begin;
do $submit$
declare
 p uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); ph uuid:=gen_random_uuid();
 v_conv uuid; v_reg uuid; v_msg text; v_promoter_msg text;
begin
 set local session_replication_role='replica';
 insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values
 (p,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa261-p-'||replace(p::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
 (a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa261-a-'||replace(a::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());
 set local session_replication_role='origin';
 insert into public.profiles(id,role,first_name,last_name,actif,age_verified,consent_accepted_at,niveau_interne)
 values(p,'promoteur','Test','Soumission',true,true,now(),1),(a,'admin','Test','Admin',true,true,now(),1);
 insert into public.pharmacies(id,nom,ville,lat,lng,actif,visible_recherche)
 values(ph,'Pharmacie test règlement','Yaoundé',3.87,11.52,true,true);
 insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut,architecture_code)
 values(p,30000,current_date+30,'active','PARENTS_AINES_CADETS') returning id into v_conv;
 insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut)
 values(p,v_conv,30000,current_date,current_date+30,'actif');
 insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses)
 values(ph,'PARENTS_AINES_CADETS',p,true,5,5);
 insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(p,ph,true);
 select public.promoteur_soumettre_reglement(p,30000,'orange_money',null,'+237690000000','REF-261',now(),
   p::text||'/12345678-1234-1234-1234-123456789012.pdf') into v_reg;
 select corps into v_msg from public.notifications where user_id=a and type='abonnement_reglement_a_verifier' order by created_at desc limit 1;
 select corps into v_promoter_msg from public.notifications where user_id=p and type='abonnement_reglement_soumis' order by created_at desc limit 1;
 if v_reg is null then raise exception 'Reglement not created'; end if;
 if v_msg is null or position('Test Soumission' in v_msg)=0 or position('Pharmacie test règlement' in v_msg)=0 then raise exception 'Admin payment alert missing promoter/pharmacy'; end if;
 if v_promoter_msg is null then raise exception 'Promoter submission confirmation missing'; end if;
end
$submit$;
rollback;
select '261_promoteur_payment_submission_notification_runtime PASS (transaction rolled back)' as resultat;

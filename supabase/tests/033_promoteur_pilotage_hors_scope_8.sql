-- NAXA Vérification 8 — Pilotage / données hors périmètre
begin;
create temp table v8_ids(promoteur uuid,a uuid,b uuid,c uuid);
do $$ declare p uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); begin
 set local session_replication_role='replica';
 insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values(p,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','v8-promoteur@example.test','x',now(),'{}','{}',now(),now());
 insert into public.profiles(id,role,username,first_name,last_name,phone,phone_country,date_of_birth,age_verified,consent_accepted_at,actif,fonction_interne,niveau_interne,niveau_hierarchique) values(p,'promoteur','v8promoteur','V8','Promoteur','+237690000081','CM','1990-01-01',true,now(),true,'promoteur',1,1);
 set local session_replication_role='origin';
 insert into public.pharmacies(id,nom,lat,lng,actif) values(a,'V8 A',3.86,11.51,true),(b,'V8 B',3.87,11.52,true),(c,'V8 C',3.88,11.53,true);
 insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(p,a,true),(p,b,true);
 insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses)
 values(a,'ORPHELIN',p,true,0,1),(b,'ORPHELIN',p,true,0,1);
 insert into public.evenements(type,pharmacie_id,terme,resultats) values('recherche',a,'a',1),('fiche_vue',a,'a',1),('panier_ajout',a,'a',1),('recherche',b,'b',0),('fiche_vue',b,'b',1),('recherche',c,'c',1),('recherche',null,'global',0);
 insert into v8_ids values(p,a,b,c);
end $$;
grant select on v8_ids to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select promoteur::text from v8_ids),true);
select set_config('request.jwt.claims',json_build_object('sub',(select promoteur::text from v8_ids),'role','authenticated')::text,true);
-- 8.1 uniquement A+B, jamais C/non attribué.
select case when (public.stats_pilotage_scope(7)->'pharmacies'->>'total')::int=2 then 1 else 1/0 end;
select case when (public.stats_pilotage_scope(7)->'recherches'->>'total')::int=2 then 1 else 1/0 end;
select case when (public.stats_pilotage_scope(7)->'recherches'->>'sans_resultat')::int=1 then 1 else 1/0 end;
select case when (public.stats_pilotage_scope(7)->'entonnoir'->>'fiches_vues')::int=2 then 1 else 1/0 end;
select case when (public.stats_pilotage_scope(7)->'entonnoir'->>'paniers')::int=1 then 1 else 1/0 end;
rollback;
select 'Verification 8 — Pilotage hors périmètre : PASS transactionnel' as resultat;
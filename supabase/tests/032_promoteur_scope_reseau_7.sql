-- NAXA Vérification 7 — Scope pharmacie + réseau
-- Test transactionnel : aucun fixture ne doit persister.
begin;

create temp table v7_ids(promoteur uuid,a uuid,b uuid,c uuid);

do $$
declare p uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); conv uuid;
begin
  set local session_replication_role='replica';
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(p,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','v7-promoteur@example.test','x',now(),'{}','{}',now(),now());
  insert into public.profiles(id,role,username,first_name,last_name,phone,phone_country,date_of_birth,age_verified,consent_accepted_at,actif,fonction_interne,niveau_interne,niveau_hierarchique)
  values(p,'promoteur','v7promoteur','V7','Promoteur','+237690000071','CM','1990-01-01',true,now(),true,'promoteur',1,1);
  set local session_replication_role='origin';
  insert into public.pharmacies(id,nom,lat,lng,actif) values(a,'V7 A',3.86,11.51,true),(b,'V7 B',3.87,11.52,true),(c,'V7 C',3.88,11.53,true);
  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(p,a,true),(p,b,true);
  insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut,architecture_code) values(p,30000,current_date+30,'active','ORPHELIN') returning id into conv;
  insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut) values(p,conv,30000,current_date,current_date+30,'actif');
  insert into public.evenements(type,pharmacie_id,terme,resultats) values('recherche',a,'a',1),('recherche',b,'b',0),('recherche',c,'c',1),('recherche',null,'global',0);
  insert into v7_ids values(p,a,b,c);
end $$;

grant select on v7_ids to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select promoteur::text from v7_ids),true);
select set_config('request.jwt.claims',json_build_object('sub',(select promoteur::text from v7_ids),'role','authenticated')::text,true);

-- 7.1 Le scope PHARMACIE suit exclusivement les liens actifs.
select case when public.naxa_scope_allows((select promoteur from v7_ids),(select a from v7_ids),'PHARMACIE') then 1 else 1/0 end;
select case when public.naxa_scope_allows((select promoteur from v7_ids),(select b from v7_ids),'PHARMACIE') then 1 else 1/0 end;
select case when not public.naxa_scope_allows((select promoteur from v7_ids),(select c from v7_ids),'PHARMACIE') then 1 else 1/0 end;

-- 7.2 Le scope RESEAU ne donne pas accès à une pharmacie hors réseau.
select case when public.naxa_scope_allows((select promoteur from v7_ids),null,'RESEAU') then 1 else 1/0 end;
select case when not public.naxa_scope_allows((select promoteur from v7_ids),(select c from v7_ids),'RESEAU') then 1 else 1/0 end;

-- 7.3 Désactivation du lien ferme immédiatement le scope, réactivation le restaure.
update public.promoteur_pharmacies set actif=false where promoteur_id=(select promoteur from v7_ids) and pharmacie_id=(select b from v7_ids);
select case when not public.naxa_scope_allows((select promoteur from v7_ids),(select b from v7_ids),'PHARMACIE') then 1 else 1/0 end;
update public.promoteur_pharmacies set actif=true where promoteur_id=(select promoteur from v7_ids) and pharmacie_id=(select b from v7_ids);
select case when public.naxa_scope_allows((select promoteur from v7_ids),(select b from v7_ids),'PHARMACIE') then 1 else 1/0 end;

-- 7.4 Le pilotage Promoteur suit les pharmacies A+B via le scope canonique et exclut C + non attribué.
select case when (public.stats_pilotage_scope(7)->'pharmacies'->>'total')::int=2 then 1 else 1/0 end;
select case when (public.stats_pilotage_scope(7)->'recherches'->>'total')::int=2 then 1 else 1/0 end;
select case when (public.stats_pilotage_scope(7)->'recherches'->>'sans_resultat')::int=1 then 1 else 1/0 end;

rollback;
select 'Verification 7 — Scope pharmacie + réseau : PASS transactionnel' as resultat;

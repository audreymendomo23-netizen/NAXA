-- NAXA Vérification 8 — Pilotage / données hors périmètre
begin;
create temp table v8_ids(promoteur uuid,a uuid,b uuid,c uuid);
do $$ declare p uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); begin
 insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values(p,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','v8-promoteur@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"naxa_signup_pending":true}'::jsonb,now(),now());
 insert into public.profiles(id,role,username,first_name,last_name,phone,phone_country,date_of_birth,age_verified,consent_accepted_at,actif,fonction_interne,niveau_interne,niveau_hierarchique,architecture_code) values(p,'promoteur','v8promoteur','V8','Promoteur','+237690000081','CM','1990-01-01',true,now(),true,'promoteur',1,1,'ORPHELIN');
 insert into public.pharmacies(id,nom,lat,lng,actif) values(a,'V8 A',3.86,11.51,true),(b,'V8 B',3.87,11.52,true),(c,'V8 C',3.88,11.53,true);
 insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut,architecture_code)
 values(p,30000,current_date+30,'active','ORPHELIN');
 insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut)
 select p,id,30000,current_date,current_date+30,'actif' from public.conventions_promoteurs where promoteur_id=p;
 insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses)
 values(a,'ORPHELIN',p,true,0,1),(b,'ORPHELIN',p,true,0,1);
 insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(p,a,true),(p,b,true);
 insert into public.naxa_profile_privileges(profile_id,privilege_code,pharmacie_id,scope_type,granted_by,active) values(p,'VIEW_NETWORK_PILOTAGE',null,'RESEAU',p,true) on conflict(profile_id,privilege_code,pharmacie_id,scope_type) do update set active=true,revoked_at=null;
 insert into public.evenements(type,pharmacie_id,terme,resultats) values('recherche',a,'a',1),('fiche_vue',a,'a',1),('panier_ajout',a,'a',1),('recherche',b,'b',0),('fiche_vue',b,'b',1),('recherche',c,'c',1),('recherche',null,'global',0);

 insert into public.produits(id,nom)
 values('33000000-0000-0000-0000-000000000033','V8 Produit KPI');
 insert into public.stocks(pharmacie_id,produit_id,prix,quantite)
 values(a,'33000000-0000-0000-0000-000000000033',2500,5),
       (b,'33000000-0000-0000-0000-000000000033',2500,0),
       (c,'33000000-0000-0000-0000-000000000033',2500,9);
 insert into public.reservations(client_id,pharmacie_id,statut,total,expires_at,mode,paiement_statut)
 values(p,a,'retiree'::resa_statut,12000,now()+interval '1 day','reservation','effectue'),
       (p,b,'expiree'::resa_statut,7000,now()+interval '1 day','reservation','a_verifier'),
       (p,c,'retiree'::resa_statut,5000,now()+interval '1 day','reservation','effectue');
 insert into public.alertes(pharmacie_id,type,message,lue)
 values(a,'v8_test','Alerte dans scope',false),
       (c,'v8_test','Alerte hors scope',false);
 insert into v8_ids values(p,a,b,c);
end $$;
grant select on v8_ids to authenticated;
select set_config('request.jwt.claim.sub',(select promoteur::text from v8_ids),true);
select set_config('request.jwt.claims',json_build_object('sub',(select promoteur::text from v8_ids),'role','authenticated')::text,true);
-- 8.1 uniquement A+B, jamais C/non attribué.
do $v8assert$
declare v_json jsonb;
begin
  v_json := public.stats_pilotage_scope(7);
  if (v_json->'pharmacies'->>'total')::int <> 2 then raise exception '8.1 pharmacies attendues=2, obtenu=%',v_json->'pharmacies'->>'total'; end if;
  if (v_json->'recherches'->>'total')::int <> 2 then raise exception '8.2 recherches attendues=2, obtenu=%',v_json->'recherches'->>'total'; end if;
  if (v_json->'recherches'->>'sans_resultat')::int <> 1 then raise exception '8.3 recherches sans résultat attendues=1, obtenu=%',v_json->'recherches'->>'sans_resultat'; end if;
  if (v_json->'entonnoir'->>'fiches_vues')::int <> 2 then raise exception '8.4 fiches vues attendues=2, obtenu=%',v_json->'entonnoir'->>'fiches_vues'; end if;
  if (v_json->'entonnoir'->>'paniers')::int <> 1 then raise exception '8.5 paniers attendus=1, obtenu=%',v_json->'entonnoir'->>'paniers'; end if;

  if (v_json->'entonnoir'->>'reservations')::int <> 2 then raise exception '8.6 reservations attendues=2'; end if;
  if (v_json->'entonnoir'->>'ventes')::int <> 1 then raise exception '8.7 ventes attendues=1'; end if;
  if (v_json->>'ca')::int <> 12000 then raise exception '8.8 CA attendu=12000'; end if;
  if (v_json->'stock'->>'produits_en_stock')::int <> 1 then raise exception '8.9 produits en stock attendus=1'; end if;
  if (v_json->'stock'->>'ruptures')::int <> 1 then raise exception '8.10 ruptures attendues=1'; end if;
  if (v_json->>'alertes')::int <> 1 then raise exception '8.11 alertes attendues=1'; end if;
  if (v_json->'performance'->>'taux_retrait')::numeric <> 50 then raise exception '8.12 taux retrait attendu=50'; end if;
  if jsonb_array_length(v_json->'serie') <> 7 then raise exception '8.13 série quotidienne attendue=7 jours'; end if;

end
$v8assert$;

select true as naxa_033_pilotage_scope_pass;
rollback;
select 'Verification 8 — Pilotage hors périmètre : PASS transactionnel' as resultat;
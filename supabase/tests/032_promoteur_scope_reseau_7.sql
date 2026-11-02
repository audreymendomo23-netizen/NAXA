-- NAXA Vérification 7 — Scope pharmacie + réseau
-- Test transactionnel : aucun fixture ne doit persister.
begin;

create temp table v7_ids(promoteur uuid,a uuid,b uuid,c uuid);

do $$
declare p uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
begin
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(p,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','v7-promoteur@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"naxa_signup_pending":true}'::jsonb,now(),now());
  insert into public.profiles(id,role,username,first_name,last_name,phone,phone_country,date_of_birth,age_verified,consent_accepted_at,actif,fonction_interne,niveau_interne,niveau_hierarchique)
  values(p,'promoteur','v7promoteur','V7','Promoteur','+237690000071','CM','1990-01-01',true,now(),true,'promoteur',1,1);
  insert into public.pharmacies(id,nom,lat,lng,actif) values(a,'V7 A',3.86,11.51,true),(b,'V7 B',3.87,11.52,true),(c,'V7 C',3.88,11.53,true);
  insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut,architecture_code)
  values(p,30000,current_date+30,'active','ORPHELIN');
  insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut)
  select p,id,30000,current_date,current_date+30,'actif' from public.conventions_promoteurs where promoteur_id=p;
  insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses)
  values(a,'ORPHELIN',p,true,0,1),(b,'ORPHELIN',p,true,0,1);
  -- Le lien Promoteur/pharmacie est créé après l'architecture afin que le trigger
  -- de provisioning puisse immédiatement attribuer les privilèges canoniques.
  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(p,a,true),(p,b,true);
  insert into public.evenements(type,pharmacie_id,terme,resultats) values('recherche',a,'a',1),('recherche',b,'b',0),('recherche',c,'c',1),('recherche',null,'global',0);
  insert into v7_ids values(p,a,b,c);
end $$;

grant select on v7_ids to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select promoteur::text from v7_ids),true);
select set_config('request.jwt.claims',json_build_object('sub',(select promoteur::text from v7_ids),'role','authenticated')::text,true);

-- 7.1 Le scope PHARMACIE suit exclusivement les liens actifs.
do $$ begin if not public.naxa_scope_allows((select promoteur from v7_ids),(select a from v7_ids),'PHARMACIE') then raise exception '7.1-A dans scope'; end if; end $$;
do $$ begin if not (public.naxa_scope_allows((select promoteur from v7_ids),(select b from v7_ids),'PHARMACIE')) then raise exception '7.3 réactivation'; end if; end $$;
do $$ begin if not (not public.naxa_scope_allows((select promoteur from v7_ids),(select c from v7_ids),'PHARMACIE')) then raise exception '7.1-C hors scope'; end if; end $$;

-- 7.2 Le scope RESEAU ne donne pas accès à une pharmacie hors réseau.
do $$ begin if not (public.naxa_scope_allows((select promoteur from v7_ids),null,'RESEAU')) then raise exception '7.2 réseau global'; end if; end $$;
do $$ begin if not (not public.naxa_scope_allows((select promoteur from v7_ids),(select c from v7_ids),'RESEAU')) then raise exception '7.2-C hors réseau'; end if; end $$;
set local role postgres;
update public.naxa_profile_privileges
   set active=false, revoked_at=now()
 where profile_id=(select promoteur from v7_ids)
   and privilege_code='VIEW_NETWORK_PILOTAGE'
   and scope_type='RESEAU' and pharmacie_id is null;
set local role authenticated;

do $$ begin
  begin
    perform public.stats_pilotage_scope(7);
    raise exception '7.2-D privilège réseau révoqué mais accès encore autorisé';
  exception when others then
    if sqlerrm <> 'Privilège Pilotage réseau requis' then raise; end if;
  end;
end $$;

set local role postgres;
update public.naxa_profile_privileges
   set active=true, revoked_at=null
 where profile_id=(select promoteur from v7_ids)
   and privilege_code='VIEW_NETWORK_PILOTAGE'
   and scope_type='RESEAU' and pharmacie_id is null;
set local role authenticated;

-- 7.3 Désactivation du lien ferme immédiatement le scope, réactivation le restaure.
set local role postgres;
update public.promoteur_pharmacies set actif=false where promoteur_id=(select promoteur from v7_ids) and pharmacie_id=(select b from v7_ids);
set local role authenticated;
do $$ begin if not (not public.naxa_scope_allows((select promoteur from v7_ids),(select b from v7_ids),'PHARMACIE')) then raise exception '7.3 désactivation'; end if; end $$;
set local role postgres;
update public.promoteur_pharmacies set actif=true where promoteur_id=(select promoteur from v7_ids) and pharmacie_id=(select b from v7_ids);
set local role authenticated;
do $$ begin if not public.naxa_scope_allows((select promoteur from v7_ids),(select b from v7_ids),'PHARMACIE') then raise exception '7.3 réactivation'; end if; end $$;

-- 7.4 Le pilotage Promoteur suit les pharmacies A+B via le scope canonique et exclut C + non attribué.
do $$ begin if not ((public.stats_pilotage_scope(7)->'pharmacies'->>'total')::int=2) then raise exception '7.4 pharmacies=2'; end if; end $$;
do $$ begin if not ((public.stats_pilotage_scope(7)->'recherches'->>'total')::int=2) then raise exception '7.4 recherches=2'; end if; end $$;
do $$ begin if not ((public.stats_pilotage_scope(7)->'recherches'->>'sans_resultat')::int=1) then raise exception '7.4 sans_resultat=1'; end if; end $$;

rollback;
select 'Verification 7 — Scope pharmacie + réseau : PASS transactionnel' as resultat;

-- NAXA 133 — validité Promoteur sur convention et abonnement canoniques.
-- Transactionnel : fixtures supprimées par ROLLBACK.
begin;
create temp table v133_ids(promoteur uuid, pharmacie_a uuid, pharmacie_b uuid);

do $$
declare
  p uuid := gen_random_uuid();
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid;
begin
  set local session_replication_role = 'replica';
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(p,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','v133-promoteur@example.test','x',now(),'{}','{}',now(),now());
  insert into public.profiles(id,role,username,first_name,last_name,phone,phone_country,date_of_birth,age_verified,consent_accepted_at,actif,fonction_interne,niveau_interne,niveau_hierarchique,architecture_code)
  values(p,'promoteur','v133promoteur','V133','Promoteur','+237690000133','CM','1990-01-01',true,now(),true,'promoteur',1,1,'ORPHELIN');
  set local session_replication_role = 'origin';

  insert into public.pharmacies(id,nom,lat,lng,actif)
  values(a,'V133 A',3.86,11.51,true),(b,'V133 B',3.87,11.52,true);

  insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut,architecture_code)
  values(p,30000,current_date+30,'active','ORPHELIN') returning id into c;
  insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut)
  values(p,c,30000,current_date,current_date+30,'actif');
  insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses)
  values(a,'ORPHELIN',p,true,0,1),(b,'ORPHELIN',p,true,0,1);
  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values(p,a,true),(p,b,true);
  insert into v133_ids values(p,a,b);
end $$;

grant select on v133_ids to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select promoteur::text from v133_ids),true);
select set_config('request.jwt.claims',json_build_object('sub',(select promoteur::text from v133_ids),'role','authenticated')::text,true);

do $$ begin
  if not public.naxa_promoteur_valide((select promoteur from v133_ids))
  then raise exception '133.1 abonnement canonique actif doit valider le Promoteur sans abonnement legacy par pharmacie'; end if;
end $$;

reset role;
update public.abonnements_promoteurs set statut='impaye',echeance=current_date-1 where promoteur_id=(select promoteur from v133_ids);
set local role authenticated;
select set_config('request.jwt.claim.sub',(select promoteur::text from v133_ids),true);
select set_config('request.jwt.claims',json_build_object('sub',(select promoteur::text from v133_ids),'role','authenticated')::text,true);

do $$ begin
  if public.naxa_promoteur_valide((select promoteur from v133_ids))
  then raise exception '133.2 un abonnement canonique impayé doit bloquer le Promoteur'; end if;
end $$;

reset role;
update public.abonnements_promoteurs set statut='actif',echeance=current_date+30 where promoteur_id=(select promoteur from v133_ids);
update public.pharmacies set actif=false where id=(select pharmacie_b from v133_ids);
set local role authenticated;
select set_config('request.jwt.claim.sub',(select promoteur::text from v133_ids),true);
select set_config('request.jwt.claims',json_build_object('sub',(select promoteur::text from v133_ids),'role','authenticated')::text,true);

do $$ begin
  if public.naxa_promoteur_valide((select promoteur from v133_ids))
  then raise exception '133.3 une pharmacie inactive du réseau doit invalider le Promoteur'; end if;
end $$;

rollback;
select 'Vérification 133 — validité Promoteur canonique : PASS transactionnel' as resultat;

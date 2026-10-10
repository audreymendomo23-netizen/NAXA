-- NAXA 018b — acceptance test Responsable après replay complet.
-- Responsable est une fonction interne portée par role='pharmacie', pas une valeur role_type.
-- Toutes les données de test sont transactionnelles et rollbackées.

begin;

do $test$
declare
  v_actor uuid := '018b0000-0000-4000-8000-000000000001';
  v_admin uuid := '018b0000-0000-4000-8000-000000000002';
  v_promoteur uuid := '018b0000-0000-4000-8000-000000000003';
  v_a uuid := '018b0000-0000-4000-8000-000000000101';
  v_b uuid := '018b0000-0000-4000-8000-000000000102';
  v_convention uuid;
  v_json jsonb;
begin
  set local session_replication_role = replica;
  insert into auth.users(
    instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values
    ('00000000-0000-0000-0000-000000000000',v_actor,'authenticated','authenticated','naxa-test-018b-resp@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
    ('00000000-0000-0000-0000-000000000000',v_admin,'authenticated','authenticated','naxa-test-018b-admin@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
    ('00000000-0000-0000-0000-000000000000',v_promoteur,'authenticated','authenticated','naxa-test-018b-promoteur@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now())
  on conflict(id) do nothing;
  set local session_replication_role = origin;

  insert into public.pharmacies(id,nom,ville,lat,lng,slug,est_demo,actif)
  values
    (v_a,'NAXA Test 018b A','Yaoundé',3.8511,11.5051,'naxa-test-018b-a',false,true),
    (v_b,'NAXA Test 018b B','Yaoundé',3.8512,11.5052,'naxa-test-018b-b',false,true)
  on conflict(id) do nothing;

  insert into public.profiles(id,role,actif,fonction_interne,niveau_interne,niveau_hierarchique,architecture_code)
  values(v_admin,'admin',true,'admin',0,0,'PARENTS_AINES_CADETS')
  on conflict(id) do update set role='admin',actif=true;

  insert into public.profiles(id,role,actif,fonction_interne,niveau_interne,niveau_hierarchique,architecture_code)
  values(v_promoteur,'promoteur',true,'promoteur',1,1,'PARENTS_AINES_CADETS')
  on conflict(id) do update set role='promoteur',actif=true,fonction_interne='promoteur',niveau_interne=1,niveau_hierarchique=1,architecture_code='PARENTS_AINES_CADETS';

  insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut,architecture_code)
  values(v_promoteur,30000,current_date+30,'active','PARENTS_AINES_CADETS')
  on conflict(promoteur_id) do update set date_expiration=current_date+30,statut='active',architecture_code='PARENTS_AINES_CADETS'
  returning id into v_convention;

  insert into public.profiles(id,role,actif,pharmacie_id,parent_profile_id,fonction_interne,niveau_interne,niveau_hierarchique,architecture_code)
  values(v_actor,'pharmacie',true,v_a,v_promoteur,'responsable',2,2,'PARENTS_AINES_CADETS')
  on conflict(id) do update set role='pharmacie',actif=true,pharmacie_id=v_a,parent_profile_id=v_promoteur,fonction_interne='responsable',niveau_interne=2,niveau_hierarchique=2,architecture_code='PARENTS_AINES_CADETS';

  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values(v_promoteur,v_a,true)
  on conflict(promoteur_id,pharmacie_id) do update set actif=true;

  insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses)
  values(v_a,'PARENTS_AINES_CADETS',v_promoteur,true,5,5)
  on conflict(pharmacie_id) do update set architecture_code=excluded.architecture_code,assigned_by=excluded.assigned_by,active=true;

  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_admin::text,'role','authenticated')::text,true);
  perform public.naxa_grant_privilege(v_actor,'VIEW_RESPONSABLE_PILOTAGE',v_a,'PHARMACIE');

  insert into public.evenements(type,pharmacie_id,resultats)
  values ('recherche',v_a,1),('recherche',v_b,1);

  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_actor::text,'role','authenticated')::text,true);
  v_json := public.stats_pilotage_scope(7);

  if v_json->>'role' <> 'pharmacie' or v_json->>'fonction_interne' <> 'responsable' then
    raise exception 'Le profil Responsable doit être représenté par role=pharmacie + fonction_interne=responsable; obtenu role=%, fonction=%',
      v_json->>'role',v_json->>'fonction_interne';
  end if;
  if (v_json->'pharmacies'->>'total')::int <> 1 then
    raise exception 'Responsable scope attendu=1, obtenu=%',v_json->'pharmacies'->>'total';
  end if;
  if (v_json->'recherches'->>'total')::int <> 1 then
    raise exception 'Responsable recherches attendu=1 (A seulement), obtenu=%',v_json->'recherches'->>'total';
  end if;
end
$test$;

rollback;

select '018b Responsable — PASS transactionnel' as resultat;

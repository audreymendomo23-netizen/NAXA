-- NAXA 018b — acceptance test Responsable après replay complet.
-- Responsable est une fonction interne portée par role='pharmacie', pas une valeur role_type.
-- Toutes les données de test sont transactionnelles et rollbackées.

begin;

do $test$
declare
  v_actor uuid := '018b0000-0000-4000-8000-000000000001';
  v_a uuid := '018b0000-0000-4000-8000-000000000101';
  v_b uuid := '018b0000-0000-4000-8000-000000000102';
  v_json jsonb;
begin
  set local session_replication_role = replica;

  insert into auth.users(
    instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_actor,'authenticated','authenticated','naxa-test-018b@example.invalid','x',now(),
    '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()
  ) on conflict(id) do nothing;

  set local session_replication_role = origin;

  insert into public.pharmacies(id,nom,ville,lat,lng,slug,est_demo,actif)
  values
    (v_a,'NAXA Test 018b A','Yaoundé',3.8511,11.5051,'naxa-test-018b-a',false,true),
    (v_b,'NAXA Test 018b B','Yaoundé',3.8512,11.5052,'naxa-test-018b-b',false,true)
  on conflict(id) do nothing;

  insert into public.profiles(id,role,actif,pharmacie_id,fonction_interne,niveau_interne,niveau_hierarchique,architecture_code)
  values(v_actor,'pharmacie',true,v_a,'responsable',2,2,'PARENTS_AINES_CADETS')
  on conflict(id) do update
    set role='pharmacie',actif=true,pharmacie_id=v_a,
        fonction_interne='responsable',niveau_interne=2,
        niveau_hierarchique=2,architecture_code='PARENTS_AINES_CADETS';

  insert into public.naxa_profile_privileges(profile_id,privilege_code,pharmacie_id,scope_type,granted_by,active)
  values(v_actor,'VIEW_RESPONSABLE_PILOTAGE',v_a,'PHARMACIE',v_actor,true)
  on conflict(profile_id,privilege_code,pharmacie_id,scope_type)
  do update set active=true,revoked_at=null,granted_by=excluded.granted_by,granted_at=now();

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

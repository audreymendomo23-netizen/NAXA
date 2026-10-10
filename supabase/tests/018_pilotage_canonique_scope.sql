-- NAXA 018 — acceptance test canonique Pilotage par scope
-- Exécution attendue dans une transaction ; ce test ne doit laisser aucune donnée persistante.
begin;

-- Fixtures propres au test : elles sont créées dans la transaction puis rollbackées.
-- Ne dépend ni d'un seed partagé ni de données préexistantes.
-- Fixtures propres au test : elles sont créées dans la transaction puis rollbackées.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
(
  '00000000-0000-0000-0000-000000000000',
  '01800000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'naxa-test-admin-018@example.invalid', '',
  now(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"naxa-test-admin-018","first_name":"Test","last_name":"Admin","phone":"+237600000001","phone_country":"CM","date_of_birth":"1990-01-01","consent_accepted":true}'::jsonb,
  now(), now()
),
(
  '00000000-0000-0000-0000-000000000000',
  '01800000-0000-4000-8000-000000000002',
  'authenticated', 'authenticated', 'naxa-test-promoteur-018@example.invalid', '',
  now(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"naxa-test-promoteur-018","first_name":"Test","last_name":"Promoteur","phone":"+237600000002","phone_country":"CM","date_of_birth":"1990-01-01","consent_accepted":true}'::jsonb,
  now(), now()
);

insert into public.pharmacies(id, nom, ville, lat, lng, slug, est_demo)
values
  ('01800000-0000-4000-8000-000000000101','NAXA Test A 018','Yaoundé',3.8480,11.5021,'naxa-test-a-018',false),
  ('01800000-0000-4000-8000-000000000102','NAXA Test B 018','Yaoundé',3.8490,11.5031,'naxa-test-b-018',false),
  ('01800000-0000-4000-8000-000000000103','NAXA Test C 018','Yaoundé',3.8500,11.5041,'naxa-test-c-018',false);

do $pilotage$
declare
  v_admin uuid;
  v_promoteur uuid;
  v_a uuid;
  v_b uuid;
  v_c uuid;
  v_json jsonb;
  v_failed boolean := false;
begin
  v_admin := '01800000-0000-4000-8000-000000000001';
  v_promoteur := '01800000-0000-4000-8000-000000000002';
  v_a := '01800000-0000-4000-8000-000000000101';
  v_b := '01800000-0000-4000-8000-000000000102';
  v_c := '01800000-0000-4000-8000-000000000103';

  update public.profiles set role='admin', actif=true, pharmacie_id=null where id=v_admin;
  update public.profiles set role='promoteur', actif=true, pharmacie_id=v_a where id=v_promoteur;
  -- Prépare l'architecture et la validité commerciale requises par le moteur canonique.
  insert into public.conventions_promoteurs(id,promoteur_id,montant_mensuel,date_expiration,statut,architecture_code)
  values('01800000-0000-4000-8000-000000000201',v_promoteur,30000,current_date+30,'active','PARENTS_AINES_CADETS')
  on conflict (promoteur_id) do nothing;

  insert into public.abonnements_promoteurs(id,promoteur_id,convention_id,montant_mensuel,debut,echeance,statut)
  values('01800000-0000-4000-8000-000000000202',v_promoteur,
         (select id from public.conventions_promoteurs where promoteur_id=v_promoteur),
         30000,current_date,current_date+30,'actif')
  on conflict (promoteur_id) do nothing;

  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values(v_promoteur,v_a,true),(v_promoteur,v_b,true)
  on conflict (promoteur_id,pharmacie_id) do update set actif=true;

  insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses)
  values(v_a,'PARENTS_AINES_CADETS',v_admin,true,5,5),
        (v_b,'PARENTS_AINES_CADETS',v_admin,true,5,5)
  on conflict (pharmacie_id) do update
    set architecture_code=excluded.architecture_code,active=true,
        max_responsables=excluded.max_responsables,max_caisses=excluded.max_caisses;

  insert into public.naxa_profile_privileges(profile_id,privilege_code,pharmacie_id,scope_type,granted_by,active)
  values
    (v_promoteur,'VIEW_NETWORK_PILOTAGE',null,'RESEAU',v_admin,true),
    (v_promoteur,'VIEW_CAISSE_PILOTAGE',v_a,'PHARMACIE',v_admin,true),
    (v_promoteur,'VIEW_RESPONSABLE_PILOTAGE',v_a,'PHARMACIE',v_admin,true);

  update public.pharmacies set est_demo=false where id in (v_a,v_b,v_c);

  insert into public.evenements(type,pharmacie_id,resultats) values
    ('recherche',null,0),
    ('recherche',v_a,1),
    ('recherche',v_c,1);

  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_admin::text,'role','authenticated')::text,true);
  v_json := public.stats_pilotage_scope(7);
  if (v_json->'pharmacies'->>'total')::int <> 3 then
    raise exception 'Admin scope attendu=3, obtenu=%',v_json->'pharmacies'->>'total';
  end if;
  if (v_json->'recherches'->>'total')::int <> 3 then
    raise exception 'Admin recherches attendu=3, obtenu=%',v_json->'recherches'->>'total';
  end if;

  perform set_config('request.jwt.claim.sub',v_promoteur::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_promoteur::text,'role','authenticated')::text,true);
  v_json := public.stats_pilotage_scope(7);
  if (v_json->'pharmacies'->>'total')::int <> 2 then
    raise exception 'Promoteur scope attendu=2, obtenu=%',v_json->'pharmacies'->>'total';
  end if;
  if (v_json->'recherches'->>'total')::int <> 1 then
    raise exception 'Promoteur recherches attendu=1 (A seulement), obtenu=%',v_json->'recherches'->>'total';
  end if;

  -- Caisse : même pharmacie A uniquement.
  update public.profiles set role='caisse', actif=true, pharmacie_id=v_a, niveau_interne=3 where id=v_promoteur;
  perform set_config('request.jwt.claim.sub',v_promoteur::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_promoteur::text,'role','authenticated')::text,true);
  v_json := public.stats_pilotage_scope(7);
  if (v_json->'pharmacies'->>'total')::int <> 1 then
    raise exception 'Caisse scope attendu=1, obtenu=%',v_json->'pharmacies'->>'total';
  end if;
  if (v_json->'recherches'->>'total')::int <> 1 then
    raise exception 'Caisse recherches attendu=1 (A seulement), obtenu=%',v_json->'recherches'->>'total';
  end if;

  -- Client : aucun accès au moteur de Pilotage.
  update public.profiles set role='client', actif=true, pharmacie_id=null, niveau_interne=4 where id=v_promoteur;
  perform set_config('request.jwt.claim.sub',v_promoteur::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_promoteur::text,'role','authenticated')::text,true);
  begin
    perform public.stats_pilotage_scope(7);
    v_failed := true;
  exception when others then
    null;
  end;
  if v_failed then
    raise exception 'Client doit être refusé par stats_pilotage_scope';
  end if;

  -- Responsable : fonction métier + niveau interne 2, sans utiliser role_type=responsable.
  -- Le rôle technique historique reste 'pharmacie' ; le scope est celui de la pharmacie A.
  update public.profiles
    set role='pharmacie',
        fonction_interne='responsable',
        niveau_interne=2,
        niveau_hierarchique=2,
        pharmacie_id=v_a,
        actif=true
  where id=v_promoteur;

  perform set_config('request.jwt.claim.sub',v_promoteur::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_promoteur::text,'role','authenticated')::text,true);
  v_json := public.stats_pilotage_scope(7);
  if (v_json->'pharmacies'->>'total')::int <> 1 then
    raise exception 'Responsable scope attendu=1, obtenu=%',v_json->'pharmacies'->>'total';
  end if;
  if (v_json->'recherches'->>'total')::int <> 1 then
    raise exception 'Responsable recherches attendu=1 (A seulement), obtenu=%',v_json->'recherches'->>'total';
  end if;
  if exists(select 1 from public.profiles where id=v_promoteur and role::text='responsable') then
    raise exception 'Responsable ne doit pas être porté par role_type=responsable';
  end if;

end
$pilotage$;

rollback;

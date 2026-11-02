-- NAXA Étape 13 — test d'acceptation des indicateurs consolidés des comptes.
-- À exécuter dans une transaction sur l'environnement Replay. Aucun fixture ne persiste.

begin;

insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('00000000-0000-0000-0000-000000000000','01300000-0000-4000-8000-000000000001','authenticated','authenticated','naxa-e13-admin@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"username":"naxa-e13-admin","first_name":"Test","last_name":"Admin","phone":"+237600000131","phone_country":"CM","date_of_birth":"1990-01-01","consent_accepted":true}'::jsonb,now(),now()),
('00000000-0000-0000-0000-000000000000','01300000-0000-4000-8000-000000000002','authenticated','authenticated','naxa-e13-promoteur@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"username":"naxa-e13-promoteur","first_name":"Test","last_name":"Promoteur","phone":"+237600000132","phone_country":"CM","date_of_birth":"1990-01-01","consent_accepted":true}'::jsonb,now(),now()),
('00000000-0000-0000-0000-000000000000','01300000-0000-4000-8000-000000000003','authenticated','authenticated','naxa-e13-caisse@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"username":"naxa-e13-caisse","first_name":"Test","last_name":"Caisse","phone":"+237600000133","phone_country":"CM","date_of_birth":"1990-01-01","consent_accepted":true}'::jsonb,now(),now()),
('00000000-0000-0000-0000-000000000000','01300000-0000-4000-8000-000000000004','authenticated','authenticated','naxa-e13-responsable@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"username":"naxa-e13-responsable","first_name":"Test","last_name":"Responsable","phone":"+237600000134","phone_country":"CM","date_of_birth":"1990-01-01","consent_accepted":true}'::jsonb,now(),now()),
('00000000-0000-0000-0000-000000000000','01300000-0000-4000-8000-000000000005','authenticated','authenticated','naxa-e13-pharmacien@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"username":"naxa-e13-pharmacien","first_name":"Test","last_name":"Pharmacien","phone":"+237600000135","phone_country":"CM","date_of_birth":"1990-01-01","consent_accepted":true}'::jsonb,now(),now()),
('00000000-0000-0000-0000-000000000000','01300000-0000-4000-8000-000000000006','authenticated','authenticated','naxa-e13-stock@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"username":"naxa-e13-stock","first_name":"Test","last_name":"Stock","phone":"+237600000136","phone_country":"CM","date_of_birth":"1990-01-01","consent_accepted":true}'::jsonb,now(),now()),
('00000000-0000-0000-0000-000000000000','01300000-0000-4000-8000-000000000007','authenticated','authenticated','naxa-e13-comptable@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"username":"naxa-e13-comptable","first_name":"Test","last_name":"Comptable","phone":"+237600000137","phone_country":"CM","date_of_birth":"1990-01-01","consent_accepted":true}'::jsonb,now(),now()),
('00000000-0000-0000-0000-000000000000','01300000-0000-4000-8000-000000000008','authenticated','authenticated','naxa-e13-client@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"username":"naxa-e13-client","first_name":"Test","last_name":"Client","phone":"+237600000138","phone_country":"CM","date_of_birth":"1990-01-01","consent_accepted":true}'::jsonb,now(),now());

insert into public.pharmacies(id,nom,ville,lat,lng,slug,est_demo,actif)
values
('01300000-0000-4000-8000-000000000101','NAXA E13 Pharmacie active','Yaoundé',3.8480,11.5021,'naxa-e13-active',false,true),
('01300000-0000-4000-8000-000000000102','NAXA E13 Pharmacie démo','Yaoundé',3.8490,11.5031,'naxa-e13-demo',true,true);

update public.profiles set role='admin',actif=true,pharmacie_id=null,niveau_interne=1 where id='01300000-0000-4000-8000-000000000001';
update public.profiles set role='promoteur',fonction_interne='promoteur',actif=true,pharmacie_id=null,niveau_interne=1,architecture_code=null where id='01300000-0000-4000-8000-000000000002';
update public.profiles set role='caisse',fonction_interne='caisse',actif=true,pharmacie_id='01300000-0000-4000-8000-000000000101',parent_profile_id='01300000-0000-4000-8000-000000000002',niveau_interne=3,niveau_hierarchique=3 where id='01300000-0000-4000-8000-000000000003';
update public.profiles set role='pharmacie',fonction_interne='responsable',actif=true,pharmacie_id='01300000-0000-4000-8000-000000000101',parent_profile_id='01300000-0000-4000-8000-000000000002',niveau_interne=2,niveau_hierarchique=2 where id='01300000-0000-4000-8000-000000000004';
update public.profiles set role='pharmacie',fonction_interne='pharmacien',actif=true,pharmacie_id='01300000-0000-4000-8000-000000000101',parent_profile_id='01300000-0000-4000-8000-000000000002',niveau_interne=3,niveau_hierarchique=3 where id='01300000-0000-4000-8000-000000000005';
update public.profiles set role='pharmacie',fonction_interne='gestionnaire_stock',actif=true,pharmacie_id='01300000-0000-4000-8000-000000000101',parent_profile_id='01300000-0000-4000-8000-000000000002',niveau_interne=3,niveau_hierarchique=3 where id='01300000-0000-4000-8000-000000000006';
update public.profiles set role='pharmacie',fonction_interne='comptable',actif=true,pharmacie_id='01300000-0000-4000-8000-000000000101',parent_profile_id='01300000-0000-4000-8000-000000000002',niveau_interne=3,niveau_hierarchique=3 where id='01300000-0000-4000-8000-000000000007';
update public.profiles set role='client',fonction_interne=null,actif=true,pharmacie_id=null,niveau_interne=4 where id='01300000-0000-4000-8000-000000000008';

insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
values('01300000-0000-4000-8000-000000000002','01300000-0000-4000-8000-000000000101',true);

insert into public.reservations(client_id,pharmacie_id,total,expires_at,created_at)
values
('01300000-0000-4000-8000-000000000008','01300000-0000-4000-8000-000000000101',2500,now()+interval '1 hour',now()),
('01300000-0000-4000-8000-000000000008','01300000-0000-4000-8000-000000000102',3000,now()+interval '1 hour',now());

do $test$
declare
  v_admin uuid := '01300000-0000-4000-8000-000000000001';
  v_promoteur uuid := '01300000-0000-4000-8000-000000000002';
  v_json jsonb;
  v_ph jsonb;
  v_prom jsonb;
  v_denied boolean := false;
  v_public regprocedure := 'public.admin_comptes_indicateurs(integer)'::regprocedure;
  v_private regprocedure := 'private.admin_comptes_indicateurs(integer)'::regprocedure;
  v_pharmacy_helper regprocedure := 'private.admin_pharmacy_account_metrics(uuid,integer)'::regprocedure;
begin
  if not (select prosecdef from pg_proc where oid=v_public)
     or not (select prosecdef from pg_proc where oid=v_private)
     or not (select prosecdef from pg_proc where oid=v_pharmacy_helper) then
    raise exception 'E13.1 : les façades et moteurs doivent être SECURITY DEFINER';
  end if;

  if has_function_privilege('anon',v_public,'EXECUTE')
     or not has_function_privilege('authenticated',v_public,'EXECUTE')
     or has_function_privilege('authenticated',v_private,'EXECUTE')
     or has_function_privilege('authenticated',v_pharmacy_helper,'EXECUTE')
     or has_function_privilege('anon',v_private,'EXECUTE')
     or has_function_privilege('anon',v_pharmacy_helper,'EXECUTE') then
    raise exception 'E13.2 : ACL de la façade ou des moteurs privés incorrecte';
  end if;

  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_admin::text,'role','authenticated')::text,true);
  v_json := public.admin_comptes_indicateurs(30);

  if (v_json->'totaux'->>'clients_total')::integer < 1
     or (v_json->'totaux'->>'promoteurs_total')::integer < 1
     or (v_json->'totaux'->>'comptes_professionnels')::integer < 6 then
    raise exception 'E13.3 : agrégats globaux des comptes incomplets : %',v_json->'totaux';
  end if;

  select e.value into v_ph
  from jsonb_array_elements(v_json->'par_pharmacie') e(value)
  where e.value->>'id'='01300000-0000-4000-8000-000000000101';
  if v_ph is null then raise exception 'E13.4 : pharmacie active absente du détail'; end if;

  if (v_ph->'indicateurs'->>'reservations')::integer <> 1
     or (v_ph->'indicateurs'->>'clients_avec_reservation')::integer <> 1 then
    raise exception 'E13.5 : métriques client/réservation incorrectes : %',v_ph->'indicateurs';
  end if;

  if not exists (
    select 1 from jsonb_array_elements(v_ph->'comptes') e(value)
    where e.value->>'role'='caisse' and e.value->>'fonction_interne'='caisse'
      and e.value->>'actif'='true' and (e.value->>'total')::integer=1
  ) then
    raise exception 'E13.6 : compte Caisse absent de la ventilation pharmacie';
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_json->'par_pharmacie') e(value)
    where e.value->>'id'='01300000-0000-4000-8000-000000000102'
  ) then
    raise exception 'E13.7 : pharmacie démo exposée dans les chiffres réseau';
  end if;

  select e.value into v_prom
  from jsonb_array_elements(v_json->'par_promoteur') e(value)
  where e.value->>'id'=v_promoteur::text;
  if v_prom is null
     or (v_prom->>'pharmacies_total')::integer <> 1
     or (v_prom->'indicateurs'->>'reservations')::integer <> 1 then
    raise exception 'E13.8 : agrégat Promoteur incorrect : %',v_prom;
  end if;

  if (v_json->'sources'->>'affectations_professionnelles')::boolean is not true
     or (v_json->'sources'->>'preparations_prescriptions')::boolean is not true
     or (v_json->'sources'->>'audit_pharmacien')::boolean is not true
     or (v_json->'sources'->>'controles_comptables')::boolean is not true then
    raise exception 'E13.9 : sources métiers Replay attendues disponibles : %',v_json->'sources';
  end if;

  perform set_config('request.jwt.claim.sub',v_promoteur::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_promoteur::text,'role','authenticated')::text,true);
  begin
    perform public.admin_comptes_indicateurs(30);
  exception when others then
    v_denied := true;
  end;
  if not v_denied then raise exception 'E13.10 : le Promoteur ne doit pas appeler les indicateurs globaux Admin'; end if;
end;
$test$;

select 'Étape 13 — indicateurs globaux des comptes par pharmacie et Promoteur : PASS' as resultat;
rollback;

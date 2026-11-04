-- NAXA 296 — tester les RPC Stock et le provisionnement Caisse sur des profils autonomes.
-- Toutes les identités, affectations et sessions ouvertes sont annulées en fin de test.
begin;
create temporary table naxa_role_296_results(
  test text primary key,
  ok boolean not null,
  detail text not null
) on commit drop;

do $test$
declare
  v_admin uuid:=gen_random_uuid();
  v_cashier uuid:=gen_random_uuid();
  v_stock uuid:=gen_random_uuid();
  v_pharmacy_a uuid:='f97647dc-86d0-4c06-abca-f7bed12b5e6d';
  v_pharmacy_b uuid:='76dd4983-273a-4a83-ae3d-9a7838d3aa35';
  v_now timestamptz:=now();
  v_session uuid;
  v_role text;
  v_pharmacy uuid;
  v_rejected boolean;
  v_base_role text;
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at)
  values
    (v_admin,'authenticated','authenticated','naxa-296-'||replace(v_admin::text,'-','')||'@example.invalid','',v_now,
      '{}'::jsonb,jsonb_build_object('username','naxa296_'||substr(replace(v_admin::text,'-',''),1,12),'naxa_signup_pending',true),false,v_now,v_now),
    (v_cashier,'authenticated','authenticated','naxa-296-'||replace(v_cashier::text,'-','')||'@example.invalid','',v_now,
      '{}'::jsonb,jsonb_build_object('username','naxa296_'||substr(replace(v_cashier::text,'-',''),1,12),'naxa_signup_pending',true),false,v_now,v_now),
    (v_stock,'authenticated','authenticated','naxa-296-'||replace(v_stock::text,'-','')||'@example.invalid','',v_now,
      '{}'::jsonb,jsonb_build_object('username','naxa296_'||substr(replace(v_stock::text,'-',''),1,12),'naxa_signup_pending',true),false,v_now,v_now);

  insert into public.profiles(id,role,username,actif)
  values
    (v_admin,'admin','naxa296_'||substr(replace(v_admin::text,'-',''),1,12),true),
    (v_cashier,'client','naxa296_'||substr(replace(v_cashier::text,'-',''),1,12),true),
    (v_stock,'client','naxa296_'||substr(replace(v_stock::text,'-',''),1,12),true);

  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_admin::text,'role','authenticated')::text,true);

  if public.naxa_business_function(v_admin)<>'admin' or not public.is_admin() then
    raise exception 'Le poste Admin de base doit être reconnu avant les opérations';
  end if;

  -- Ancienne signature conservée : elle attribue maintenant le poste sans toucher au rôle Auth.
  perform public.naxa_provision_caisse(v_cashier,v_pharmacy_a);
  select role::text into v_base_role from public.profiles where id=v_cashier;
  select public.naxa_business_function(v_cashier),public.naxa_active_role_pharmacy(v_cashier)
    into v_role,v_pharmacy;
  if v_base_role<>'client' or v_role<>'caisse' or v_pharmacy is distinct from v_pharmacy_a
     or not exists(select 1 from public.naxa_professional_assignments a
       where a.profile_id=v_cashier and a.pharmacie_id=v_pharmacy_a
         and a.role_code='caisse' and a.statut='active') then
    raise exception 'Le provisionnement Caisse a converti l''identité ou omis l''affectation';
  end if;
  insert into naxa_role_296_results values('provisionnement_caisse_sans_conversion_auth',true,
    'Base Auth/Profil conservée en Client, poste Caisse attribué séparément');

  -- La même personne reçoit Stock et Caisse pour une autre pharmacie : un seul poste est actif.
  perform public.naxa_grant_professional_assignment(
    v_stock,v_pharmacy_b,'gestionnaire_stock',v_now,null,'Test poste Gestionnaire Stock 296'
  );
  perform public.naxa_grant_professional_assignment(
    v_stock,v_pharmacy_b,'caisse',v_now,null,'Test poste Caisse 296'
  );
  perform set_config('request.jwt.claim.sub',v_stock::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_stock::text,'role','authenticated')::text,true);
  select public.naxa_business_function(v_stock),public.naxa_active_role_pharmacy(v_stock)
    into v_role,v_pharmacy;
  if v_role<>'gestionnaire_stock' or v_pharmacy is distinct from v_pharmacy_b then
    raise exception 'La première affectation Stock n''est pas active ou n''est pas limitée à B';
  end if;
  if not public.naxa_stock_manager_actor(v_pharmacy_b)
     or public.naxa_stock_manager_actor(v_pharmacy_a) then
    raise exception 'Le helper Stock ne respecte pas la pharmacie active';
  end if;
  insert into naxa_role_296_results values('stock_manager_scope_actif',true,
    'Gestionnaire Stock reconnu uniquement dans la pharmacie B');

  v_session:=public.stock_service_open(v_pharmacy_b,'Recette transactionnelle migration 296');
  if not exists(select 1 from public.stock_service_sessions s
    where s.id=v_session and s.gestionnaire_id=v_stock and s.pharmacie_id=v_pharmacy_b and s.status='open') then
    raise exception 'La prise de service Stock ne crée pas la session attendue';
  end if;
  insert into naxa_role_296_results values('ouverture_service_stock_autorisee',true,
    'Le poste Gestionnaire Stock actif ouvre son service sur B');

  perform public.naxa_select_active_role('caisse',v_pharmacy_b);
  if public.naxa_business_function(v_stock)<>'caisse'
     or public.naxa_stock_manager_actor(v_pharmacy_b) then
    raise exception 'Le rôle Caisse conserve des droits Stock';
  end if;
  v_rejected:=false;
  begin
    perform public.stock_service_open(v_pharmacy_b,'Ne doit pas ouvrir en Caisse');
  exception when others then
    v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Le rôle Caisse peut ouvrir un service Stock'; end if;
  insert into naxa_role_296_results values('refus_stock_quand_caisse_actif',true,
    'Le poste Caisse n''hérite pas du droit de prise de service Stock');

  perform public.naxa_select_active_role('client',null);
  if public.naxa_business_function(v_stock)<>'client'
     or public.naxa_active_role_pharmacy(v_stock) is not null
     or public.naxa_stock_manager_actor(v_pharmacy_b) then
    raise exception 'Le retour Client conserve un privilège ou un scope Stock';
  end if;
  v_rejected:=false;
  begin
    perform public.stock_service_open(v_pharmacy_b,'Ne doit pas ouvrir en Client');
  exception when others then
    v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Le rôle Client peut ouvrir un service Stock'; end if;
  insert into naxa_role_296_results values('refus_stock_apres_retour_client',true,
    'Le retour Client ferme le scope et les RPC Stock');

  -- L'ancien RPC Caisse ne peut pas être utilisé depuis un autre poste Admin que celui sélectionné.
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_admin::text,'role','authenticated')::text,true);
  perform public.naxa_grant_professional_assignment(
    v_admin,v_pharmacy_b,'caisse',v_now,null,'Test Admin bascule vers Caisse'
  );
  perform public.naxa_select_active_role('caisse',v_pharmacy_b);
  if public.naxa_business_function(v_admin)<>'caisse' or public.is_admin() then
    raise exception 'Le rôle Admin conserve ses privilèges globaux après bascule vers Caisse';
  end if;
  v_rejected:=false;
  begin
    perform public.naxa_provision_caisse(gen_random_uuid(),v_pharmacy_a);
  exception when others then
    v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Le profil Admin basculé sur Caisse conserve la capacité de provisionnement NAXA'; end if;
  insert into naxa_role_296_results values('admin_global_suspendu_en_poste_caisse',true,
    'Après Admin → Caisse, is_admin=false et l''ancienne RPC de provisionnement est refusée');

end;
$test$;

select * from naxa_role_296_results order by test;
rollback;

-- NAXA 298 — tests transactionnels des RPC Inventaire/Stock et Admin actif.
begin;
create temporary table naxa_role_298_results(
  test text primary key,
  ok boolean not null,
  detail text not null
) on commit drop;

do $test$
declare
  v_admin uuid:=gen_random_uuid();
  v_stock_user uuid:=gen_random_uuid();
  v_admin_multi uuid:=gen_random_uuid();
  v_pharmacy uuid:='f97647dc-86d0-4c06-abca-f7bed12b5e6d';
  v_now timestamptz:=now();
  v_inventory uuid;
  v_service uuid;
  v_role text;
  v_rejected boolean;
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at)
  values
    (v_admin,'authenticated','authenticated','naxa-298-'||replace(v_admin::text,'-','')||'@example.invalid','',v_now,
      '{}'::jsonb,jsonb_build_object('username','naxa298_'||substr(replace(v_admin::text,'-',''),1,12),'naxa_signup_pending',true),false,v_now,v_now),
    (v_stock_user,'authenticated','authenticated','naxa-298-'||replace(v_stock_user::text,'-','')||'@example.invalid','',v_now,
      '{}'::jsonb,jsonb_build_object('username','naxa298_'||substr(replace(v_stock_user::text,'-',''),1,12),'naxa_signup_pending',true),false,v_now,v_now),
    (v_admin_multi,'authenticated','authenticated','naxa-298-'||replace(v_admin_multi::text,'-','')||'@example.invalid','',v_now,
      '{}'::jsonb,jsonb_build_object('username','naxa298_'||substr(replace(v_admin_multi::text,'-',''),1,12),'naxa_signup_pending',true),false,v_now,v_now);

  insert into public.profiles(id,role,username,actif)
  values
    (v_admin,'admin','naxa298_'||substr(replace(v_admin::text,'-',''),1,12),true),
    (v_stock_user,'client','naxa298_'||substr(replace(v_stock_user::text,'-',''),1,12),true),
    (v_admin_multi,'admin','naxa298_'||substr(replace(v_admin_multi::text,'-',''),1,12),true);

  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_admin::text,'role','authenticated')::text,true);
  perform public.naxa_grant_professional_assignment(
    v_stock_user,v_pharmacy,'gestionnaire_stock',v_now,null,'Recette inventaire poste Stock 298'
  );

  perform set_config('request.jwt.claim.sub',v_stock_user::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_stock_user::text,'role','authenticated')::text,true);
  select public.naxa_business_function(v_stock_user) into v_role;
  if v_role<>'gestionnaire_stock'
     or (select role::text from public.profiles where id=v_stock_user)<>'client' then
    raise exception 'Le poste Gestionnaire Stock n''a pas été attribué indépendamment de l''identité';
  end if;
  insert into naxa_role_298_results values('stock_attribue_sans_conversion',true,
    'Le compte reste Client, le poste Gestionnaire de stock est actif');

  v_inventory:=public.gestionnaire_stock_inventaire_demarrer(
    v_pharmacy,'cible'::public.inventaire_type,'E2E rôle autonome 298'
  );
  if not exists(select 1 from public.inventaires i
    where i.id=v_inventory and i.pharmacie_id=v_pharmacy and i.created_by=v_stock_user
      and i.statut='en_cours') then
    raise exception 'Le poste Stock ne peut pas démarrer un inventaire';
  end if;
  insert into naxa_role_298_results values('demarrage_inventaire_client_avec_poste_stock',true,
    'L''inventaire est ouvert par le profil Client muni du poste Stock');

  v_service:=public.gestionnaire_stock_service_ouvrir(v_pharmacy);
  if not exists(select 1 from public.gestionnaire_stock_sessions s
    where s.id=v_service and s.user_id=v_stock_user and s.pharmacie_id=v_pharmacy
      and s.ended_at is null) then
    raise exception 'Le poste Stock ne peut pas ouvrir son service historique';
  end if;
  insert into naxa_role_298_results values('ouverture_service_stock_historique',true,
    'La session du service Stock est ouverte dans la pharmacie active');

  perform public.gestionnaire_stock_service_fermer(v_service,'Fermeture de recette');
  if not exists(select 1 from public.gestionnaire_stock_sessions s
    where s.id=v_service and s.ended_at is not null) then
    raise exception 'Le service Stock ne peut pas être fermé par son titulaire actif';
  end if;
  insert into naxa_role_298_results values('fermeture_service_stock_actif',true,
    'Le service peut être fermé lorsque le poste Stock est sélectionné');

  v_service:=public.gestionnaire_stock_service_ouvrir(v_pharmacy);
  perform public.naxa_select_active_role('client',null);
  v_rejected:=false;
  begin
    perform public.gestionnaire_stock_service_fermer(v_service,'Ne doit pas fermer en Client');
  exception when others then
    v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Le poste Client peut fermer un service Stock resté ouvert'; end if;
  if public.naxa_business_function(v_stock_user)<>'client'
     or public.naxa_active_role_pharmacy(v_stock_user) is not null then
    raise exception 'Le retour Client ne ferme pas le scope Stock';
  end if;
  insert into naxa_role_298_results values('refus_fermeture_apres_changement_poste',true,
    'Le service reste protégé quand le compte quitte le poste Stock');

  v_rejected:=false;
  begin
    perform public.inventaire_cloturer(v_inventory);
  exception when others then
    v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Le poste Client peut clôturer un inventaire Stock'; end if;
  insert into naxa_role_298_results values('refus_cloture_inventaire_apres_changement_poste',true,
    'Le changement vers Client retire les droits de clôture Inventaire');

  -- L'identité Admin ne conserve pas le droit d'indicateurs après sélection Caisse.
  perform set_config('request.jwt.claim.sub',v_admin_multi::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_admin_multi::text,'role','authenticated')::text,true);
  insert into public.naxa_professional_assignments(
    profile_id,pharmacie_id,fonction,role_code,statut,nature_affectation,motif,
    commence_at,expire_at,accorde_par,accorde_at
  ) values(
    v_admin_multi,v_pharmacy,'caisse','caisse','active','ordinaire',
    'Fixture Admin sélectionne Caisse pour migration 298',
    v_now,null,v_admin_multi,v_now
  );
  perform public.naxa_select_active_role('caisse',v_pharmacy);
  if public.naxa_business_function(v_admin_multi)<>'caisse' or public.is_admin() then
    raise exception 'L''Admin conserve les droits globaux en poste Caisse';
  end if;
  v_rejected:=false;
  begin
    perform public.admin_comptes_indicateurs(30);
  exception when others then
    v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Le poste Caisse peut lire les indicateurs globaux Admin'; end if;
  insert into naxa_role_298_results values('indicateurs_admin_refuses_hors_espace_admin',true,
    'La fonction Admin privée rejette le profil lorsque Caisse est le poste actif');

end;
$test$;

select * from naxa_role_298_results order by test;
rollback;

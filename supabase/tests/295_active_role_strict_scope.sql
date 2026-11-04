-- NAXA 295 — tests transactionnels des rôles actifs et des scopes multi-pharmacies.
-- Les identités, affectations et sélections de test sont toutes annulées.
begin;
create temporary table naxa_role_295_results(
  test text primary key,
  ok boolean not null,
  detail text not null
) on commit drop;

do $test$
declare
  v_a uuid:='f97647dc-86d0-4c06-abca-f7bed12b5e6d';
  v_b uuid:='76dd4983-273a-4a83-ae3d-9a7838d3aa35';
  v_client uuid:=gen_random_uuid();
  v_admin uuid:=gen_random_uuid();
  v_explicit_client uuid:=gen_random_uuid();
  v_now timestamptz:=now();
  v_role text;
  v_pharmacy uuid;
  v_assignment_a uuid;
  v_assignment_b uuid;
  v_assignment_stock uuid;
  v_admin_assignment uuid;
  v_explicit_assignment uuid;
  v_rejected boolean;
  v_is_admin boolean;
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at)
  values
    (v_client,'authenticated','authenticated','naxa-295-'||replace(v_client::text,'-','')||'@example.invalid','',v_now,'{}'::jsonb,jsonb_build_object('username','naxa295_'||substr(replace(v_client::text,'-',''),1,12),'naxa_signup_pending',true),false,v_now,v_now),
    (v_admin,'authenticated','authenticated','naxa-295-'||replace(v_admin::text,'-','')||'@example.invalid','',v_now,'{}'::jsonb,jsonb_build_object('username','naxa295_'||substr(replace(v_admin::text,'-',''),1,12),'naxa_signup_pending',true),false,v_now,v_now),
    (v_explicit_client,'authenticated','authenticated','naxa-295-'||replace(v_explicit_client::text,'-','')||'@example.invalid','',v_now,'{}'::jsonb,jsonb_build_object('username','naxa295_'||substr(replace(v_explicit_client::text,'-',''),1,12),'naxa_signup_pending',true),false,v_now,v_now);

  insert into public.profiles(id,role,username,actif)
  values
    (v_client,'client','naxa295_'||substr(replace(v_client::text,'-',''),1,12),true),
    (v_admin,'admin','naxa295_'||substr(replace(v_admin::text,'-',''),1,12),true),
    (v_explicit_client,'client','naxa295_'||substr(replace(v_explicit_client::text,'-',''),1,12),true);

  -- Deux affectations du même poste, deux pharmacies distinctes.
  insert into public.naxa_professional_assignments(
    profile_id,pharmacie_id,fonction,role_code,statut,nature_affectation,motif,
    commence_at,expire_at,accorde_par,accorde_at
  ) values(v_client,v_a,'caisse','caisse','active','ordinaire','Test Caisse pharmacie A',v_now,null,v_client,v_now)
  returning id into v_assignment_a;

  select public.naxa_business_function(v_client),public.naxa_active_role_pharmacy(v_client)
    into v_role,v_pharmacy;
  if v_role<>'caisse' or v_pharmacy is distinct from v_a then
    raise exception 'Première affectation non sélectionnée: rôle %, pharmacie %',v_role,v_pharmacy;
  end if;
  insert into naxa_role_295_results values('premiere_affectation_active',true,'Caisse / pharmacie A');

  insert into public.naxa_professional_assignments(
    profile_id,pharmacie_id,fonction,role_code,statut,nature_affectation,motif,
    commence_at,expire_at,accorde_par,accorde_at
  ) values(v_client,v_b,'caisse','caisse','active','ordinaire','Test Caisse pharmacie B',v_now,null,v_client,v_now+interval '1 second')
  returning id into v_assignment_b;

  select public.naxa_business_function(v_client),public.naxa_active_role_pharmacy(v_client)
    into v_role,v_pharmacy;
  if v_role<>'caisse' or v_pharmacy is distinct from v_a then
    raise exception 'Une seconde affectation a écrasé le poste actif explicitement établi';
  end if;
  perform set_config('request.jwt.claim.sub',v_client::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_client::text,'role','authenticated')::text,true);

  if not private.naxa_scope_allows(v_client,v_a,'PHARMACIE')
     or private.naxa_scope_allows(v_client,v_b,'PHARMACIE') then
    raise exception 'La personne accède à plusieurs pharmacies avec un seul poste actif';
  end if;
  if not public.naxa_has_active_professional_assignment(v_client,v_a,'caisse')
     or public.naxa_has_active_professional_assignment(v_client,v_b,'caisse') then
    raise exception 'Le helper d''affectation ne respecte pas le scope actif';
  end if;
  insert into naxa_role_295_results values('isolation_pharmacie_active_A',true,'Accès à A, refus de B malgré une affectation dans les deux pharmacies');

  perform public.naxa_select_active_role('caisse',v_b);
  select public.naxa_business_function(v_client),public.naxa_active_role_pharmacy(v_client)
    into v_role,v_pharmacy;
  if v_role<>'caisse' or v_pharmacy is distinct from v_b then
    raise exception 'Le changement vers la pharmacie B échoue';
  end if;
  if private.naxa_scope_allows(v_client,v_a,'PHARMACIE')
     or not private.naxa_scope_allows(v_client,v_b,'PHARMACIE') then
    raise exception 'Le scope ne suit pas le changement vers B';
  end if;
  if public.naxa_has_active_professional_assignment(v_client,v_a,'caisse')
     or not public.naxa_has_active_professional_assignment(v_client,v_b,'caisse') then
    raise exception 'Le helper ne suit pas le changement de pharmacie';
  end if;
  insert into naxa_role_295_results values('changement_pharmacie_active_B',true,'Accès à B, refus de A');

  v_rejected:=false;
  begin
    perform public.naxa_select_active_role('livreur',v_b);
  exception when others then
    v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Un poste Livreur non attribué a été accepté'; end if;
  insert into naxa_role_295_results values('refus_poste_non_attribue',true,'Livreur absent des affectations, sélection refusée');

  -- Le poste Caisse peut être quitté même si les affectations subsistent.
  perform public.naxa_select_active_role('client',null);
  select public.naxa_business_function(v_client),public.naxa_active_role_pharmacy(v_client)
    into v_role,v_pharmacy;
  if v_role<>'client' or v_pharmacy is not null then
    raise exception 'Le retour à Client ne rétablit pas l''espace de base';
  end if;
  if private.naxa_scope_allows(v_client,v_a,'PHARMACIE')
     or private.naxa_scope_allows(v_client,v_b,'PHARMACIE') then
    raise exception 'L''espace Client conserve un scope pharmacie';
  end if;
  insert into naxa_role_295_results values('retour_espace_base_client',true,'Client actif, aucun accès pharmacie');

  -- Une nouvelle affectation ne doit pas écraser un espace Client explicitement sélectionné.
  perform set_config('request.jwt.claim.sub',v_explicit_client::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_explicit_client::text,'role','authenticated')::text,true);
  perform public.naxa_select_active_role('client',null);
  insert into public.naxa_professional_assignments(
    profile_id,pharmacie_id,fonction,role_code,statut,nature_affectation,motif,
    commence_at,expire_at,accorde_par,accorde_at
  ) values(v_explicit_client,v_a,'caisse','caisse','active','ordinaire','Test conservation du choix Client',v_now,null,v_explicit_client,v_now);
  if public.naxa_business_function(v_explicit_client)<>'client'
     or public.naxa_active_role_pharmacy(v_explicit_client) is not null then
    raise exception 'Une affectation a écrasé le choix Client explicite';
  end if;
  insert into naxa_role_295_results values('choix_client_preserve_a_l_attribution',true,'L’attribution d’un poste ne change pas l’espace déjà choisi');

  -- L'Administrateur perd ses droits globaux lorsqu'il passe au poste Caisse.
  insert into public.naxa_professional_assignments(
    profile_id,pharmacie_id,fonction,role_code,statut,nature_affectation,motif,
    commence_at,expire_at,accorde_par,accorde_at
  ) values(v_admin,v_a,'caisse','caisse','active','ordinaire','Test Admin vers Caisse',v_now,null,v_admin,v_now)
  returning id into v_admin_assignment;

  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_admin::text,'role','authenticated')::text,true);
  select public.naxa_business_function(v_admin),public.is_admin()
    into v_role,v_is_admin;
  if v_role<>'caisse' or v_is_admin is distinct from false then
    raise exception 'L''Admin conserve le rôle global après changement d''espace';
  end if;
  if not private.naxa_scope_allows(v_admin,v_a,'PHARMACIE')
     or private.naxa_scope_allows(v_admin,v_b,'PHARMACIE') then
    raise exception 'L''Admin en poste Caisse n''est pas limité à sa pharmacie';
  end if;
  insert into naxa_role_295_results values('admin_restriction_vers_caisse',true,'Le rôle global Admin est suspendu dans le poste Caisse');

  perform public.naxa_select_active_role('admin',null);
  if public.naxa_business_function(v_admin)<>'admin' or not public.is_admin() then
    raise exception 'Le retour explicite à Admin ne restaure pas ses droits globaux';
  end if;
  insert into naxa_role_295_results values('retour_admin_explicite',true,'Les droits globaux reviennent uniquement après sélection Admin');

  -- Révocation du poste actif : prochain poste valide, puis rôle de base Client.
  perform set_config('request.jwt.claim.sub',v_client::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_client::text,'role','authenticated')::text,true);
  perform public.naxa_select_active_role('caisse',v_b);
  update public.naxa_professional_assignments set statut='revoked',revoque_par=v_client,
    revoque_at=now(),motif_revocation='Test migration 295 : révocation B'
  where id=v_assignment_b;
  select public.naxa_business_function(v_client),public.naxa_active_role_pharmacy(v_client)
    into v_role,v_pharmacy;
  if v_role<>'caisse' or v_pharmacy is distinct from v_a then
    raise exception 'La révocation ne bascule pas sur la prochaine affectation valide';
  end if;
  update public.naxa_professional_assignments set statut='revoked',revoque_par=v_client,
    revoque_at=now(),motif_revocation='Test migration 295 : révocation A'
  where id=v_assignment_a;
  if public.naxa_business_function(v_client)<>'client'
     or public.naxa_active_role_pharmacy(v_client) is not null then
    raise exception 'Après révocation de tous les postes, le rôle de base Client n''est pas restauré';
  end if;
  insert into naxa_role_295_results values('revocation_et_repli_base',true,'Révocation successive, retour Client et aucun scope pharmacie');

  -- Le miroir legacy fonction_interne ne doit jamais réactiver un poste révoqué.
  update public.profiles set fonction_interne='livreur' where id=v_client;
  if public.naxa_business_function(v_client)<>'client' then
    raise exception 'fonction_interne a réactivé un rôle non affecté';
  end if;
  insert into naxa_role_295_results values('alias_legacy_non_autorisant',true,'fonction_interne est ignoré pour l’autorisation');

  -- Le rôle Livreur est sélectionnable comme poste autonome mais n'hérite d'aucun droit stock.
  insert into public.naxa_professional_assignments(
    profile_id,pharmacie_id,fonction,role_code,statut,nature_affectation,motif,
    commence_at,expire_at,accorde_par,accorde_at
  ) values(v_client,v_b,'livreur','livreur','active','ordinaire','Test Livreur sans droits implicites',v_now,null,v_client,v_now);
  perform public.naxa_select_active_role('livreur',v_b);
  if public.naxa_business_function(v_client)<>'livreur'
     or public.naxa_active_role_pharmacy(v_client) is distinct from v_b
     or exists(select 1 from public.naxa_architecture_privileges where role_key='livreur')
     or exists(select 1 from public.naxa_role_privileges where role_key='livreur') then
    raise exception 'Le Livreur n''est pas isolé ou a reçu des privilèges implicites';
  end if;
  insert into naxa_role_295_results values('livreur_autonome_sans_droits',true,'Poste Livreur actif, matrice des privilèges vide');

end;
$test$;

select * from naxa_role_295_results order by test;
rollback;

-- NAXA 287/288/289 — rôles professionnels autonomes, cumul et espace actif.
-- Recette transactionnelle : toutes les identités et affectations temporaires sont annulées.
begin;
create temporary table naxa_role_e2e_results (
  test text primary key,
  ok boolean not null,
  detail text not null
) on commit drop;

do $test$
declare
  v_client uuid:=gen_random_uuid();
  v_pharmacy_profile uuid:=gen_random_uuid();
  v_pharmacy uuid:='f97647dc-86d0-4c06-abca-f7bed12b5e6d';
  v_now timestamptz:=now();
  v_selected text;
  v_scope boolean;
  v_rejected boolean:=false;
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at)
  values
    (v_client,'authenticated','authenticated','naxa-role-e2e-'||replace(v_client::text,'-','')||'@example.invalid','',v_now,
      '{}'::jsonb,'{"naxa_signup_pending":true}'::jsonb,false,v_now,v_now),
    (v_pharmacy_profile,'authenticated','authenticated','naxa-role-e2e-'||replace(v_pharmacy_profile::text,'-','')||'@example.invalid','',v_now,
      '{}'::jsonb,'{"naxa_signup_pending":true}'::jsonb,false,v_now,v_now);

  insert into public.profiles(id,role,username,actif)
  values
    (v_client,'client','naxa_role_e2e_'||substr(replace(v_client::text,'-',''),1,12),true),
    (v_pharmacy_profile,'pharmacie','naxa_role_e2e_'||substr(replace(v_pharmacy_profile::text,'-',''),1,12),true);

  update public.profiles set pharmacie_id=v_pharmacy where id=v_pharmacy_profile;

  insert into public.naxa_professional_assignments(
    profile_id,pharmacie_id,fonction,role_code,statut,nature_affectation,motif,
    commence_at,expire_at,accorde_par,accorde_at
  ) values
    (v_client,v_pharmacy,'comptable','comptable','active','ordinaire','Test rôle Comptable indépendant',v_now,null,v_client,v_now-interval '3 minutes'),
    (v_client,v_pharmacy,'gestionnaire_stock','gestionnaire_stock','active','ordinaire','Test rôle Stock indépendant',v_now,null,v_client,v_now-interval '2 minutes'),
    (v_client,v_pharmacy,'livreur','livreur','active','ordinaire','Test rôle Livreur indépendant',v_now,null,v_client,v_now-interval '1 minute'),
    (v_pharmacy_profile,v_pharmacy,'responsable','responsable','active','ordinaire','Test rôle Responsable indépendant',v_now,null,v_pharmacy_profile,v_now);

  select public.naxa_business_function(v_client) into v_selected;
  if v_selected<>'comptable' then raise exception 'Première affectation non sélectionnée automatiquement: %',v_selected; end if;
  insert into naxa_role_e2e_results values('premiere_affectation_auto_selectionnee',true,v_selected);

  perform set_config('request.jwt.claim.sub',v_client::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_client::text,'role','authenticated')::text,true);

  perform public.naxa_select_active_role('gestionnaire_stock',v_pharmacy);
  select public.naxa_business_function(v_client) into v_selected;
  if v_selected<>'gestionnaire_stock' then raise exception 'Sélection du deuxième poste échouée: %',v_selected; end if;
  select public.naxa_scope_allows(v_client,v_pharmacy,'PHARMACIE') into v_scope;
  if v_scope is distinct from true then raise exception 'Le périmètre ne reconnait pas le poste sélectionné'; end if;
  insert into naxa_role_e2e_results values('selection_second_poste_et_scope',true,v_selected);

  begin
    perform public.naxa_select_active_role('pharmacien',v_pharmacy);
  exception when others then
    v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Un rôle Pharmacien non attribué a été accepté'; end if;
  insert into naxa_role_e2e_results values('refus_role_non_attribue',true,'Pharmacien non affecté refusé');

  perform public.naxa_select_active_role('livreur',v_pharmacy);
  select public.naxa_business_function(v_client) into v_selected;
  if v_selected<>'livreur' then raise exception 'Le poste Livreur n''est pas sélectionnable: %',v_selected; end if;
  if public.naxa_has_privilege('VIEW_STOCK',v_pharmacy,'PHARMACIE') is distinct from false then
    raise exception 'Le Livreur a reçu un privilège non défini';
  end if;
  insert into naxa_role_e2e_results values('livreur_sans_privilege_implicite',true,'Rôle activable, privilèges fermés par défaut');

  update public.naxa_professional_assignments
  set statut='revoked',revoque_par=v_client,revoque_at=now(),motif_revocation='Test de révocation'
  where profile_id=v_client and role_code='livreur' and statut='active';
  select public.naxa_business_function(v_client) into v_selected;
  if v_selected<>'gestionnaire_stock' then raise exception 'La révocation n''a pas sélectionné le prochain poste valide: %',v_selected; end if;
  insert into naxa_role_e2e_results values('revocation_bascule_poste_suivant',true,v_selected);

  perform set_config('request.jwt.claim.sub',v_pharmacy_profile::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_pharmacy_profile::text,'role','authenticated')::text,true);
  perform public.naxa_select_active_role('pharmacie',v_pharmacy);
  select public.naxa_business_function(v_pharmacy_profile) into v_selected;
  select public.naxa_scope_allows(v_pharmacy_profile,v_pharmacy,'PHARMACIE') into v_scope;
  if v_selected<>'pharmacie' or v_scope is distinct from true then
    raise exception 'Le rôle de base Pharmacie ne fonctionne pas avec des affectations additionnelles';
  end if;
  insert into naxa_role_e2e_results values('retour_espace_base_avec_postes',true,'Espace Pharmacie réactivé sans perdre les affectations');

  perform public.naxa_select_active_role('responsable',v_pharmacy);
  select public.naxa_business_function(v_pharmacy_profile) into v_selected;
  if v_selected<>'responsable' then raise exception 'Le poste Responsable ne peut pas redevenir actif'; end if;
  insert into naxa_role_e2e_results values('retour_poste_responsable',true,v_selected);

  if exists(select 1 from public.naxa_professional_assignments
    where profile_id in (v_client,v_pharmacy_profile) and role_code is distinct from fonction) then
    raise exception 'La clé de rôle canonique diverge de l''alias historique';
  end if;
  insert into naxa_role_e2e_results values('coherence_role_code_alias',true,'Les clés canoniques et historiques concordent');
end;
$test$;

select * from naxa_role_e2e_results order by test;
rollback;

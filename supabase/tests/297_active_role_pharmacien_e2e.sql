-- NAXA 297 — parcours E2E d'agrément Pharmacien, dépôt Client et décision métier.
-- Utilise le Promoteur de recette actif, crée des profils temporaires et termine par ROLLBACK.
begin;

create temporary table naxa_role_297_results(
  test text primary key,
  ok boolean not null,
  detail text not null
) on commit drop;

do $test$
declare
  v_admin uuid:=gen_random_uuid();
  v_pharmacist uuid:=gen_random_uuid();
  v_client uuid:=gen_random_uuid();
  v_promoter uuid:='b5b79627-46ac-4dea-8ea9-6f0464cb3404';
  v_pharmacy uuid:='76dd4983-273a-4a83-ae3d-9a7838d3aa35';
  v_other_pharmacy uuid:='86bfc15b-0737-4656-ab72-0a199acb8b1f';
  v_now timestamptz:=now();
  v_accreditation uuid;
  v_assignment uuid;
  v_consult uuid;
  v_internal_prescription uuid;
  v_client_prescription_one uuid;
  v_client_prescription_two uuid;
  v_service uuid;
  v_audit uuid;
  v_role text;
  v_selected_pharmacy uuid;
  v_count integer;
  v_rejected boolean;
  v_credential_path text;
  v_client_path_one text;
  v_client_path_two text;
begin
  if not private.naxa_promoteur_valide(v_promoter)
     or not exists(select 1 from public.promoteur_pharmacies where promoteur_id=v_promoter and pharmacie_id=v_pharmacy and actif) then
    raise exception 'Fixture Promoteur/Pharmacie invalide pour la recette';
  end if;

  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at)
  values
    (v_admin,'authenticated','authenticated','naxa-297-'||replace(v_admin::text,'-','')||'@example.invalid','',v_now,
      '{}'::jsonb,jsonb_build_object('username','naxa297_admin_'||substr(replace(v_admin::text,'-',''),1,8),'naxa_signup_pending',true),false,v_now,v_now),
    (v_pharmacist,'authenticated','authenticated','naxa-297-'||replace(v_pharmacist::text,'-','')||'@example.invalid','',v_now,
      '{}'::jsonb,jsonb_build_object('username','naxa297_pharma_'||substr(replace(v_pharmacist::text,'-',''),1,8),'naxa_signup_pending',true),false,v_now,v_now),
    (v_client,'authenticated','authenticated','naxa-297-'||replace(v_client::text,'-','')||'@example.invalid','',v_now,
      '{}'::jsonb,jsonb_build_object('username','naxa297_client_'||substr(replace(v_client::text,'-',''),1,8),'naxa_signup_pending',true),false,v_now,v_now);

  insert into public.profiles(id,role,username,actif)
  values
    (v_admin,'admin','naxa297_admin_'||substr(replace(v_admin::text,'-',''),1,8),true),
    (v_pharmacist,'client','naxa297_pharma_'||substr(replace(v_pharmacist::text,'-',''),1,8),true),
    (v_client,'client','naxa297_client_'||substr(replace(v_client::text,'-',''),1,8),true);

  v_credential_path:=v_promoter::text||'/'||v_pharmacist::text||'/'||v_pharmacy::text||'/credential.pdf';
  insert into storage.objects(bucket_id,name,owner,metadata)
  values('naxa-pharmacien-accreditations',v_credential_path,v_promoter,
    jsonb_build_object('mimetype','application/pdf','size',128));

  -- Le Promoteur propose le compte ; il n'accorde pas lui-même le poste actif.
  perform set_config('request.jwt.claim.sub',v_promoter::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_promoter::text,'role','authenticated')::text,true);
  v_accreditation:=public.naxa_proposer_accreditation_pharmacien(
    v_pharmacist,v_pharmacy,'ORDRE-E2E-297','Ordre national de recette',
    'Pharmacie générale',v_credential_path,current_date+365,'Proposition E2E soumise par le Promoteur'
  );
  if not exists(select 1 from public.naxa_pharmacien_accreditations
    where id=v_accreditation and status='pending_admin' and proposed_by=v_promoter
      and profile_id=v_pharmacist and pharmacie_id=v_pharmacy) then
    raise exception 'La proposition Pharmacien n''a pas été enregistrée en attente Admin';
  end if;
  if exists(select 1 from public.naxa_professional_assignments
    where profile_id=v_pharmacist and pharmacie_id=v_pharmacy and role_code='pharmacien' and statut='active') then
    raise exception 'Le Promoteur a activé le Pharmacien avant la validation Admin';
  end if;
  insert into naxa_role_297_results values('proposition_promoteur_sans_activation',true,
    'Le dossier est proposé par le Promoteur et demeure inactif avant décision Admin');

  -- Le sélecteur ne doit pas contourner le statut pending_admin.
  perform set_config('request.jwt.claim.sub',v_pharmacist::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_pharmacist::text,'role','authenticated')::text,true);
  v_rejected:=false;
  begin
    perform public.naxa_select_active_role('pharmacien',v_pharmacy);
  exception when others then
    v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Un Pharmacien non approuvé a pu activer son poste'; end if;
  insert into naxa_role_297_results values('blocage_avant_approbation_admin',true,
    'Le sélecteur universel refuse un agrément pending_admin');

  -- L'Admin approuve ; la fonction crée atomiquement l'affectation traçable.
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_admin::text,'role','authenticated')::text,true);
  v_assignment:=public.naxa_admin_decider_accreditation_pharmacien(v_accreditation,'approved',null);
  if not exists(select 1 from public.naxa_professional_assignments
    where id=v_assignment and profile_id=v_pharmacist and pharmacie_id=v_pharmacy
      and role_code='pharmacien' and statut='active' and accorde_par=v_promoter) then
    raise exception 'L''approbation Admin n''a pas activé l''affectation issue de la proposition';
  end if;
  insert into naxa_role_297_results values('validation_admin_et_activation',true,
    'La décision Admin approuve le justificatif et crée l''affectation Pharmacien');

  v_rejected:=false;
  begin
    perform public.naxa_grant_professional_assignment(
      v_pharmacist,v_pharmacy,'pharmacien',v_now,null,'Tentative de contournement direct'
    );
  exception when others then
    v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Le RPC générique a contourné le circuit d''agrément Admin'; end if;
  insert into naxa_role_297_results values('blocage_affectation_generique',true,
    'Le RPC générique refuse toute création directe du rôle Pharmacien');

  -- Activation du poste, sans conversion de l'identité de base Client.
  perform set_config('request.jwt.claim.sub',v_pharmacist::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_pharmacist::text,'role','authenticated')::text,true);
  perform public.naxa_select_active_role('pharmacien',v_pharmacy);
  select public.naxa_business_function(v_pharmacist),public.naxa_active_role_pharmacy(v_pharmacist)
    into v_role,v_selected_pharmacy;
  if v_role<>'pharmacien' or v_selected_pharmacy is distinct from v_pharmacy then
    raise exception 'Le poste Pharmacien validé ne devient pas actif dans sa pharmacie';
  end if;
  if (select role::text from public.profiles where id=v_pharmacist)<>'client' then
    raise exception 'L''identité de base Client a été convertie';
  end if;
  insert into naxa_role_297_results values('activation_role_autonome',true,
    'Le rôle Pharmacien est actif dans le périmètre validé et le profil de base reste Client');

  -- Le workspace reste limité à sa pharmacie, même si le Promoteur gère aussi Essos.
  v_rejected:=false;
  begin
    perform public.naxa_select_active_role('pharmacien',v_other_pharmacy);
  exception when others then
    v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Le Pharmacien peut sélectionner une pharmacie non affectée'; end if;
  insert into naxa_role_297_results values('refus_autre_pharmacie',true,
    'Le poste Pharmacien ne s''ouvre pas dans une autre pharmacie du même réseau');

  -- Fonctions ERP existantes : consultation, prescription interne, service et audit.
  v_consult:=public.pharmacien_creer_consultation(
    v_pharmacy,'Patient E2E','Consultation de recette',null,
    'Observation de test','Conclusion de test','Suivi de test'
  );
  if not exists(select 1 from public.consultations_pharmaceutiques
    where id=v_consult and pharmacie_id=v_pharmacy and created_by=v_pharmacist) then
    raise exception 'La consultation Pharmacien n''a pas été créée dans le scope actif';
  end if;
  insert into naxa_role_297_results values('creation_consultation_pharmacien',true,
    'Consultation créée et signée par le compte qui porte le poste');

  v_internal_prescription:=public.pharmacien_creer_prescription(
    v_pharmacy,'Patient E2E',null,v_consult,'e2e://document',
    'Produit de recette',1,'Selon prescription','1 jour','Instructions de test','Aucun conseil généré'
  );
  if not exists(select 1 from public.prescriptions p
    where p.id=v_internal_prescription and p.pharmacie_id=v_pharmacy
      and p.consultation_id=v_consult and p.validateur_id=v_pharmacist) then
    raise exception 'La prescription interne Pharmacien n''a pas été créée';
  end if;
  insert into naxa_role_297_results values('creation_prescription_pharmacien',true,
    'Prescription interne reliée à la consultation et validateur correct');

  v_service:=public.pharmacien_service_demarrer('Recette E2E migration Pharmacien');
  perform public.pharmacien_service_terminer(v_service,'Fin de recette E2E');
  if not exists(select 1 from public.pharmacien_service_sessions
    where id=v_service and pharmacien_id=v_pharmacist and pharmacie_id=v_pharmacy and ended_at is not null) then
    raise exception 'Le pointage Pharmacien ne s''est pas ouvert et clôturé';
  end if;
  insert into naxa_role_297_results values('ouverture_et_cloture_service',true,
    'Le poste Pharmacien ouvre et termine son service');

  v_audit:=public.pharmacien_journaliser_export('jour',1);
  if not exists(select 1 from public.pharmacien_audit_events
    where id=v_audit and pharmacie_id=v_pharmacy and actor_user_id=v_pharmacist) then
    raise exception 'L''export Pharmacien ne respecte pas le journal de la pharmacie';
  end if;
  insert into naxa_role_297_results values('export_pharmacien_audite',true,
    'L''export est journalisé côté serveur dans la pharmacie active');

  -- Un Client dépose un fichier privé ; l'ordonnance apparaît dans la file pharmacien.
  v_client_path_one:=v_client::text||'/'||v_pharmacy::text||'/ordonnance-1.pdf';
  v_client_path_two:=v_client::text||'/'||v_pharmacy::text||'/ordonnance-2.png';
  insert into storage.objects(bucket_id,name,owner,metadata)
  values
    ('naxa-client-prescriptions',v_client_path_one,v_client,jsonb_build_object('mimetype','application/pdf','size',256)),
    ('naxa-client-prescriptions',v_client_path_two,v_client,jsonb_build_object('mimetype','image/png','size',256));

  perform set_config('request.jwt.claim.sub',v_client::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_client::text,'role','authenticated')::text,true);
  v_client_prescription_one:=public.naxa_client_soumettre_ordonnance(
    v_pharmacy,v_client_path_one,'Première transmission E2E'
  );
  if not exists(select 1 from public.prescriptions
    where id=v_client_prescription_one and client_id=v_client
      and pharmacie_id=v_pharmacy and source='client' and statut='en_attente'
      and document_ref=v_client_path_one) then
    raise exception 'La soumission Client n''a pas créé un dossier d''ordonnance en attente';
  end if;
  select count(*) into v_count from public.naxa_client_mes_ordonnances() r
    where r.id=v_client_prescription_one and r.statut='en_attente';
  if v_count<>1 then raise exception 'Le Client ne retrouve pas sa transmission dans son suivi'; end if;
  insert into naxa_role_297_results values('soumission_client_et_suivi',true,
    'Document Client privé relié à la pharmacie et visible dans Mes ordonnances');

  -- Le Pharmacien prend en charge, demande un complément ; le Client voit la demande.
  perform set_config('request.jwt.claim.sub',v_pharmacist::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_pharmacist::text,'role','authenticated')::text,true);
  perform public.naxa_select_active_role('pharmacien',v_pharmacy);
  perform public.pharmacien_soumettre_preparation(v_client_prescription_one,'Document reçu et première vérification');
  perform public.pharmacien_demander_complement(v_client_prescription_one,'Merci de transmettre une photo plus lisible');
  perform set_config('request.jwt.claim.sub',v_client::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_client::text,'role','authenticated')::text,true);
  select count(*) into v_count from public.naxa_client_mes_ordonnances() r
    where r.id=v_client_prescription_one
      and r.preparation_statut='complement_requis'
      and r.motif_complement='Merci de transmettre une photo plus lisible';
  if v_count<>1 then raise exception 'Le Client ne voit pas le complément demandé par le Pharmacien'; end if;
  insert into naxa_role_297_results values('boucle_complement_client_pharmacien',true,
    'Le Pharmacien demande un complément et le Client voit le motif dans son suivi');

  -- Deuxième ordonnance : préparation puis décision explicite de validation.
  v_client_prescription_two:=public.naxa_client_soumettre_ordonnance(
    v_pharmacy,v_client_path_two,'Seconde transmission E2E'
  );
  perform set_config('request.jwt.claim.sub',v_pharmacist::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_pharmacist::text,'role','authenticated')::text,true);
  perform public.naxa_select_active_role('pharmacien',v_pharmacy);
  perform public.pharmacien_soumettre_preparation(v_client_prescription_two,'Document contrôlé');
  if public.prescription_valider(v_client_prescription_two,true,null)<>'validee' then
    raise exception 'La décision Pharmacien de validation n''a pas été enregistrée';
  end if;
  perform set_config('request.jwt.claim.sub',v_client::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_client::text,'role','authenticated')::text,true);
  select count(*) into v_count from public.naxa_client_mes_ordonnances() r
    where r.id=v_client_prescription_two and r.statut='validee';
  if v_count<>1 then raise exception 'Le Client ne voit pas la validation Pharmacien'; end if;
  insert into naxa_role_297_results values('validation_pharmacien_vue_client',true,
    'La préparation et la décision Pharmacien reviennent dans le suivi Client');

  -- Le statut d'agrément est l'autorité : son retrait neutralise immédiatement le poste.
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_admin::text,'role','authenticated')::text,true);
  perform public.naxa_admin_decider_accreditation_pharmacien(
    v_accreditation,'revoked','Retrait de recette après validation E2E'
  );
  perform set_config('request.jwt.claim.sub',v_pharmacist::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_pharmacist::text,'role','authenticated')::text,true);
  if public.naxa_business_function(v_pharmacist)='pharmacien'
     or public.naxa_active_role_pharmacy(v_pharmacist) is not null then
    raise exception 'Le retrait d''agrément n''a pas neutralisé le poste Pharmacien';
  end if;
  v_rejected:=false;
  begin
    perform public.pharmacien_creer_consultation(
      v_pharmacy,'Patient E2E','Après retrait agrément',null,null,null,null
    );
  exception when others then
    v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Le Pharmacien conserve des droits après retrait d''agrément'; end if;
  insert into naxa_role_297_results values('retrait_agrement_et_blocage_rpc',true,
    'Le retrait Admin neutralise le poste et bloque les RPC cliniques');

  -- Le client reste isolé des ordonnances d'un autre compte.
  perform set_config('request.jwt.claim.sub',v_client::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_client::text,'role','authenticated')::text,true);
  select count(*) into v_count from public.naxa_client_mes_ordonnances();
  -- La fonction est auto-scopee sur auth.uid() et ne retourne que les dossiers du Client courant.
  if v_count<>2 then raise exception 'Le suivi Client ne retourne pas exactement ses deux ordonnances'; end if;
  insert into naxa_role_297_results values('suivi_client_limite_au_compte',true,
    'Le suivi Client retourne ses deux dossiers créés par cette recette');

end;
$test$;

select * from naxa_role_297_results order by test;
rollback;

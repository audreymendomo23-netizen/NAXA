-- NAXA 297 — recette transactionnelle des RPC Pharmacien sous rôles autonomes.
-- Les comptes, consultations, prescriptions, événements et sessions de test sont rollbackés.
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
  v_pharmacy uuid:='f97647dc-86d0-4c06-abca-f7bed12b5e6d';
  v_other_pharmacy uuid:='76dd4983-273a-4a83-ae3d-9a7838d3aa35';
  v_now timestamptz:=now();
  v_consult uuid;
  v_prescription uuid;
  v_service uuid;
  v_audit uuid;
  v_role text;
  v_selected_pharmacy uuid;
  v_count integer;
  v_rejected boolean;
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at)
  values
    (v_admin,'authenticated','authenticated','naxa-297-'||replace(v_admin::text,'-','')||'@example.invalid','',v_now,
      '{}'::jsonb,jsonb_build_object('username','naxa297_'||substr(replace(v_admin::text,'-',''),1,12),'naxa_signup_pending',true),false,v_now,v_now),
    (v_pharmacist,'authenticated','authenticated','naxa-297-'||replace(v_pharmacist::text,'-','')||'@example.invalid','',v_now,
      '{}'::jsonb,jsonb_build_object('username','naxa297_'||substr(replace(v_pharmacist::text,'-',''),1,12),'naxa_signup_pending',true),false,v_now,v_now);

  insert into public.profiles(id,role,username,actif)
  values
    (v_admin,'admin','naxa297_'||substr(replace(v_admin::text,'-',''),1,12),true),
    (v_pharmacist,'client','naxa297_'||substr(replace(v_pharmacist::text,'-',''),1,12),true);

  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_admin::text,'role','authenticated')::text,true);
  perform public.naxa_grant_professional_assignment(
    v_pharmacist,v_pharmacy,'pharmacien',v_now,null,'Recette poste Pharmacien autonome'
  );

  perform set_config('request.jwt.claim.sub',v_pharmacist::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_pharmacist::text,'role','authenticated')::text,true);
  select public.naxa_business_function(v_pharmacist),public.naxa_active_role_pharmacy(v_pharmacist)
    into v_role,v_selected_pharmacy;
  if v_role<>'pharmacien' or v_selected_pharmacy is distinct from v_pharmacy then
    raise exception 'Le poste Pharmacien n''est pas devenu actif dans la pharmacie attribuée';
  end if;
  if (select role::text from public.profiles where id=v_pharmacist)<>'client' then
    raise exception 'L''identité de base Client a été convertie';
  end if;
  insert into naxa_role_297_results values('pharmacien_attribue_sans_conversion',true,
    'Le profil Auth reste Client et le poste Pharmacien est actif');

  v_consult:=public.pharmacien_creer_consultation(
    v_pharmacy,'Patient E2E','Consultation de recette',null,
    'Observation de test','Conclusion de test','Suivi de test'
  );
  if not exists(select 1 from public.consultations_pharmaceutiques
    where id=v_consult and pharmacie_id=v_pharmacy and created_by=v_pharmacist) then
    raise exception 'La consultation Pharmacien n''a pas été créée dans le scope actif';
  end if;
  insert into naxa_role_297_results values('creation_consultation_pharmacien',true,
    'Consultation créée, signée par le compte qui porte le poste');

  v_prescription:=public.pharmacien_creer_prescription(
    v_pharmacy,'Patient E2E',null,v_consult,'e2e://document',
    'Paracétamol test',1,'Selon prescription','1 jour','Instructions de test','Aucun conseil généré'
  );
  if not exists(select 1 from public.prescriptions p
    where p.id=v_prescription and p.pharmacie_id=v_pharmacy
      and p.consultation_id=v_consult and p.validateur_id=v_pharmacist) then
    raise exception 'La prescription Pharmacien n''a pas été créée dans le scope actif';
  end if;
  insert into naxa_role_297_results values('creation_prescription_pharmacien',true,
    'Prescription reliée à la consultation et validateur correct');

  select count(*) into v_count
  from public.pharmacien_prescriptions_recentes(v_pharmacy,100) r
  where r.id=v_prescription;
  if v_count<>1 then raise exception 'La lecture des prescriptions récentes ne retourne pas la prescription du scope'; end if;
  insert into naxa_role_297_results values('lecture_prescriptions_scope_actif',true,
    'Lecture de la prescription dans la pharmacie active');

  v_service:=public.pharmacien_service_demarrer('Recette E2E migration 297');
  if not exists(select 1 from public.pharmacien_service_sessions s
    where s.id=v_service and s.pharmacien_id=v_pharmacist
      and s.pharmacie_id=v_pharmacy and s.ended_at is null) then
    raise exception 'Le service Pharmacien n''a pas démarré dans le scope actif';
  end if;
  perform public.pharmacien_service_terminer(v_service,'Fin de recette E2E');
  if not exists(select 1 from public.pharmacien_service_sessions s
    where s.id=v_service and s.ended_at is not null) then
    raise exception 'Le service Pharmacien n''a pas été clôturé';
  end if;
  insert into naxa_role_297_results values('ouverture_et_cloture_service',true,
    'Le poste Pharmacien ouvre et termine son service');

  v_audit:=public.pharmacien_journaliser_export('jour',1);
  if not exists(select 1 from public.pharmacien_audit_events e
    where e.id=v_audit and e.pharmacie_id=v_pharmacy and e.actor_user_id=v_pharmacist) then
    raise exception 'L''export audité ne respecte pas le scope Pharmacien';
  end if;
  insert into naxa_role_297_results values('export_pharmacien_audite',true,
    'L''export est journalisé dans la pharmacie active');

  v_rejected:=false;
  begin
    perform public.pharmacien_creer_consultation(
      v_other_pharmacy,'Patient hors scope','Consultation interdite',null,null,null,null
    );
  exception when others then
    v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Le poste Pharmacien accepte une autre pharmacie'; end if;
  insert into naxa_role_297_results values('refus_autre_pharmacie',true,
    'Le poste Pharmacien ne peut agir dans la pharmacie B');

  perform public.naxa_select_active_role('client',null);
  if public.naxa_business_function(v_pharmacist)<>'client'
     or public.naxa_active_role_pharmacy(v_pharmacist) is not null then
    raise exception 'Le retour Client ne ferme pas le poste Pharmacien';
  end if;
  v_rejected:=false;
  begin
    perform public.pharmacien_creer_consultation(
      v_pharmacy,'Patient E2E','Après retour Client',null,null,null,null
    );
  exception when others then
    v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Le Client peut encore créer une consultation Pharmacien'; end if;
  insert into naxa_role_297_results values('retrait_acces_apres_changement_poste',true,
    'Le changement vers Client bloque les RPC Pharmacien');

end;
$test$;

select * from naxa_role_297_results order by test;
rollback;

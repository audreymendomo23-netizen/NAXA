-- NAXA 299 — recette transactionnelle Responsable délégué et Comptable autonomes.
begin;
create temporary table naxa_role_299_results(
  test text primary key,
  ok boolean not null,
  detail text not null
) on commit drop;

do $test$
declare
  v_promoter uuid:=gen_random_uuid();
  v_responsable uuid:=gen_random_uuid();
  v_comptable uuid:=gen_random_uuid();
  v_pharmacy uuid:='f97647dc-86d0-4c06-abca-f7bed12b5e6d';
  v_other_pharmacy uuid:='76dd4983-273a-4a83-ae3d-9a7838d3aa35';
  v_now timestamptz:=now();
  v_convention uuid;
  v_abonnement uuid;
  v_service uuid;
  v_rejected boolean;
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at)
  values
    (v_promoter,'authenticated','authenticated','naxa-299-'||replace(v_promoter::text,'-','')||'@example.invalid','',v_now,
      '{}'::jsonb,jsonb_build_object('username','naxa299_'||substr(replace(v_promoter::text,'-',''),1,12),'naxa_signup_pending',true),false,v_now,v_now),
    (v_responsable,'authenticated','authenticated','naxa-299-'||replace(v_responsable::text,'-','')||'@example.invalid','',v_now,
      '{}'::jsonb,jsonb_build_object('username','naxa299_'||substr(replace(v_responsable::text,'-',''),1,12),'naxa_signup_pending',true),false,v_now,v_now),
    (v_comptable,'authenticated','authenticated','naxa-299-'||replace(v_comptable::text,'-','')||'@example.invalid','',v_now,
      '{}'::jsonb,jsonb_build_object('username','naxa299_'||substr(replace(v_comptable::text,'-',''),1,12),'naxa_signup_pending',true),false,v_now,v_now);

  insert into public.profiles(id,role,username,actif,niveau_interne)
  values
    (v_promoter,'promoteur','naxa299_'||substr(replace(v_promoter::text,'-',''),1,12),true,1),
    (v_responsable,'client','naxa299_'||substr(replace(v_responsable::text,'-',''),1,12),true,4),
    (v_comptable,'client','naxa299_'||substr(replace(v_comptable::text,'-',''),1,12),true,4);

  insert into public.conventions_promoteurs(
    promoteur_id,montant_mensuel,date_paiement,date_expiration,statut,architecture_code
  ) values(v_promoter,30000,current_date,current_date+30,'active','HYBRIDE')
  returning id into v_convention;

  insert into public.abonnements_promoteurs(
    promoteur_id,convention_id,montant_mensuel,debut,echeance,statut
  ) values(v_promoter,v_convention,30000,current_date,current_date+30,'actif')
  returning id into v_abonnement;

  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values(v_promoter,v_pharmacy,true);

  insert into public.naxa_professional_assignments(
    profile_id,pharmacie_id,fonction,role_code,statut,nature_affectation,motif,
    commence_at,expire_at,accorde_par,accorde_at
  ) values
    (v_responsable,v_pharmacy,'responsable','responsable','active','ordinaire','Test Responsable autonome avec délégation',v_now,null,v_promoter,v_now),
    (v_comptable,v_pharmacy,'comptable','comptable','active','ordinaire','Test Comptable autonome',v_now,null,v_promoter,v_now);

  insert into public.naxa_profile_privileges(
    profile_id,privilege_code,pharmacie_id,scope_type,granted_by
  ) values
    (v_responsable,'APPROVE_MARKETPLACE_CREDIT',v_pharmacy,'PHARMACIE',v_promoter),
    (v_comptable,'MANAGE_ACCOUNTING',v_pharmacy,'PHARMACIE',v_promoter);

  -- Responsable : poste autonome, profil de base Client et privilège explicite.
  perform set_config('request.jwt.claim.sub',v_responsable::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_responsable::text,'role','authenticated')::text,true);

  if public.naxa_business_function(v_responsable)<>'responsable'
     or public.naxa_active_role_pharmacy(v_responsable) is distinct from v_pharmacy
     or (select role::text from public.profiles where id=v_responsable)<>'client' then
    raise exception 'Le Responsable autonome n''est pas actif sans conversion du rôle Auth';
  end if;

  if not private.naxa_actor_can_approve_marketplace_credit(v_pharmacy) then
    raise exception 'Le Responsable actif avec privilège explicite ne peut pas approuver';
  end if;
  if private.naxa_actor_can_approve_marketplace_credit(v_other_pharmacy) then
    raise exception 'Le Responsable peut approuver dans une autre pharmacie';
  end if;
  insert into naxa_role_299_results values('responsable_autonome_delegue',true,
    'Profil Client, poste Responsable et privilège explicite dans la pharmacie autorisée');

  perform public.naxa_select_active_role('client',null);
  if private.naxa_actor_can_approve_marketplace_credit(v_pharmacy) then
    raise exception 'Le retour Client conserve la capacité d''approbation Responsable';
  end if;
  insert into naxa_role_299_results values('responsable_acces_retire_apres_changement',true,
    'Le changement vers Client retire le pouvoir de décision crédit');

  -- Comptable : le scope et le service reposent sur le poste et non le profil Auth.
  perform set_config('request.jwt.claim.sub',v_comptable::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_comptable::text,'role','authenticated')::text,true);

  if public.naxa_business_function(v_comptable)<>'comptable'
     or public.naxa_active_role_pharmacy(v_comptable) is distinct from v_pharmacy
     or (select role::text from public.profiles where id=v_comptable)<>'client'
     or not public.compta_scope_autorise(v_pharmacy) then
    raise exception 'Le scope Comptable autonome n''est pas autorisé avec privilège MANAGE_ACCOUNTING';
  end if;

  v_service:=public.comptable_service_demarrer('Recette Comptable autonome 299');
  if not exists(select 1 from public.comptable_service_sessions s
    where s.id=v_service and s.comptable_id=v_comptable
      and s.pharmacie_id=v_pharmacy and s.ended_at is null) then
    raise exception 'Le service Comptable ne s''ouvre pas dans le scope actif';
  end if;
  insert into naxa_role_299_results values('comptable_service_scope_actif',true,
    'Profil Client, poste Comptable, privilège de comptabilité et service ouvert');

  perform public.naxa_select_active_role('client',null);
  if public.compta_scope_autorise(v_pharmacy) then
    raise exception 'Le retour Client conserve MANAGE_ACCOUNTING';
  end if;
  v_rejected:=false;
  begin
    perform public.comptable_service_terminer(v_service,'Ne doit pas clôturer en Client');
  exception when others then
    v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Le poste Client peut clôturer le service Comptable'; end if;
  insert into naxa_role_299_results values('comptable_acces_retire_apres_changement',true,
    'Le changement vers Client retire le scope et empêche la clôture');

end;
$test$;

select * from naxa_role_299_results order by test;
rollback;

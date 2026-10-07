-- NAXA — Partie 4 : tests contradictoires effectifs
begin;

do $test$
declare
  promoteur_id uuid;
  cible_id uuid;
  pharmacie_id uuid;
  convention_id uuid;
  abonnement_id uuid;
  granted_id uuid;
  has_it boolean;
begin
  select id into promoteur_id from public.profiles order by created_at limit 1;
  select id into cible_id from public.profiles order by created_at desc limit 1;
  select id into pharmacie_id from public.pharmacies order by created_at limit 1;

  if promoteur_id is null or cible_id is null or pharmacie_id is null then
    raise exception 'PART4_FIXTURE_MISSING';
  end if;

  -- Fixtures uniquement transactionnelles : aucun changement Production ne subsiste.
  update public.profiles
  set role='promoteur',
      pharmacie_id=pharmacie_id,
      actif=true,
      parent_profile_id=null,
      fonction_interne='promoteur',
      niveau_interne=1,
      niveau_hierarchique=1,
      architecture_code='PARENTS_AINES_CADETS',
      custom_role_code=null
  where id=promoteur_id;

  update public.profiles
  set role='pharmacie',
      pharmacie_id=pharmacie_id,
      actif=true,
      parent_profile_id=promoteur_id,
      fonction_interne='responsable',
      niveau_interne=2,
      niveau_hierarchique=2,
      architecture_code='PARENTS_AINES_CADETS',
      custom_role_code=null
  where id=cible_id;

  insert into public.pharmacie_architectures(
    pharmacie_id,architecture_code,assigned_by,max_responsables,max_caisses,active
  ) values(
    pharmacie_id,'PARENTS_AINES_CADETS',promoteur_id,5,5,true
  )
  on conflict(pharmacie_id) do update
    set architecture_code=excluded.architecture_code,
        assigned_by=excluded.assigned_by,
        max_responsables=excluded.max_responsables,
        max_caisses=excluded.max_caisses,
        active=true;

  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values(promoteur_id,pharmacie_id,true)
  on conflict do nothing;

  insert into public.conventions_promoteurs(promoteur_id,tarif_mensuel,montant_paye,date_paiement,date_expiration,statut)
  values(promoteur_id,30000,30000,now(),current_date+30,'actif')
  returning id into convention_id;

  insert into public.abonnements_promoteurs(convention_id,promoteur_id,debut,echeance,statut)
  values(convention_id,promoteur_id,current_date,current_date+30,'actif')
  returning id into abonnement_id;

  -- Le Promoteur ne peut pas s'auto-attribuer le droit de délégation :
  -- avant bootstrap NAXA, ASSIGN_PRIVILEGE est absent de ses droits effectifs.
  select set_config(
    'request.jwt.claims',
    json_build_object('sub',promoteur_id,'role','authenticated')::text,
    true
  );
  set local role authenticated;

  if public.naxa_has_privilege('ASSIGN_PRIVILEGE',pharmacie_id,'PHARMACIE') then
    raise exception 'PART4_FAIL_PROMOTEUR_ESCALADE_SANS_BOOTSTRAP';
  end if;

  -- Bootstrap NAXA simulé : retour temporaire au rôle postgres et identité admin.
  set local role postgres;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub',promoteur_id,'role','authenticated')::text,
    true
  );

  -- Bootstrap NAXA : l'admin temporaire est distinct du Promoteur.
  update public.profiles set role='admin',niveau_hierarchique=0,fonction_interne=null,niveau_interne=null,pharmacie_id=null,parent_profile_id=null,architecture_code=null,custom_role_code=null where id=cible_id;
  select set_config('request.jwt.claims',json_build_object('sub',cible_id,'role','authenticated')::text,true);
  granted_id := public.naxa_grant_privilege(promoteur_id,'ASSIGN_PRIVILEGE',pharmacie_id,'PHARMACIE');
  if granted_id is null then raise exception 'PART4_FAIL_ADMIN_BOOTSTRAP'; end if;

  -- Repassage identité Promoteur : il peut désormais déléguer un privilège
  -- autorisé à la fonction Responsable.
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub',promoteur_id,'role','authenticated')::text,
    true
  );

  granted_id := public.naxa_grant_privilege(cible_id,'VIEW_USER_PRIVILEGES',pharmacie_id,'PHARMACIE');
  if granted_id is null then raise exception 'PART4_FAIL_PROMOTEUR_DELEGATION'; end if;

  select public.naxa_has_privilege('VIEW_USER_PRIVILEGES',pharmacie_id,'PHARMACIE') into has_it;
  if has_it then
    raise exception 'PART4_FAIL_PROMOTEUR_READS_TARGET_PRIVILEGE_AS_OWN';
  end if;

  -- Un Promoteur ne peut pas déléguer un privilège de gouvernance.
  set local role postgres;
  begin
    perform public.naxa_grant_privilege(cible_id,'CHANGE_ARCHITECTURE',pharmacie_id,'PHARMACIE');
    raise exception 'PART4_FAIL_GOVERNANCE_DELEGATED';
  exception when others then
    if position('NON_DELEGABLE' in sqlerrm)=0 and position('GOUVERNANCE' in sqlerrm)=0 then
      raise;
    end if;
  end;

  -- Une Responsable ne peut cibler qu'une Caisse enfant, jamais une autre Responsable.
  update public.profiles
  set role='pharmacie',fonction_interne='responsable',niveau_interne=2,niveau_hierarchique=2,parent_profile_id=promoteur_id,pharmacie_id=pharmacie_id,actif=true,architecture_code='PARENTS_AINES_CADETS'
  where id=cible_id;

  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub',cible_id,'role','authenticated')::text,
    true
  );

  if public.naxa_can_manage_privilege_target(promoteur_id,pharmacie_id) then
    raise exception 'PART4_FAIL_RESPONSABLE_TARGETS_PROMOTEUR';
  end if;

  -- Caisse : la Responsable peut gérer son enfant, mais pas s'élever elle-même.
  update public.profiles
  set role='caisse',fonction_interne='caisse',niveau_interne=3,niveau_hierarchique=3,parent_profile_id=cible_id,pharmacie_id=pharmacie_id,actif=true,architecture_code='PARENTS_AINES_CADETS'
  where id=promoteur_id;

  if public.naxa_can_manage_privilege_target(cible_id,pharmacie_id) then
    raise exception 'PART4_FAIL_RESPONSABLE_SELF_TARGET';
  end if;
end
$test$;

rollback;

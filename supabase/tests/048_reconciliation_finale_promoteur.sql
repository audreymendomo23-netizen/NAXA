-- NAXA — Partie 6 : test contradictoire de réconciliation Promoteur
begin;

do $$
declare
  admin_id uuid;
  promoter_id uuid;
  pharmacy_id uuid;
  convention_id uuid;
begin
  select id into admin_id from public.profiles order by created_at limit 1;
  select id into promoter_id from public.profiles order by created_at desc limit 1;
  select id into pharmacy_id from public.pharmacies order by created_at limit 1;

  if admin_id is null or promoter_id is null or admin_id=promoter_id or pharmacy_id is null then
    raise exception 'PART6_FIXTURE_MISSING';
  end if;

  update public.profiles
  set role='admin', niveau_hierarchique=0, pharmacie_id=null, fonction_interne=null,
      niveau_interne=null, parent_profile_id=null, architecture_code=null, custom_role_code=null, actif=true
  where id=admin_id;

  update public.profiles
  set role='promoteur',
      niveau_hierarchique=1,
      pharmacie_id=pharmacy_id,
      fonction_interne='promoteur',
      niveau_interne=1,
      parent_profile_id=null,
      architecture_code='ORPHELIN',
      custom_role_code=null,
      actif=true
  where id=promoter_id;

  insert into public.pharmacie_architectures(
    pharmacie_id,architecture_code,assigned_by,max_responsables,max_caisses,active
  )
  values(pharmacy_id,'ORPHELIN',promoter_id,0,1,true)
  on conflict(pharmacie_id) do update set
    architecture_code='ORPHELIN',
    max_responsables=0,
    max_caisses=1,
    active=true;

  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values(promoter_id,pharmacy_id,true)
  on conflict(promoteur_id,pharmacie_id) do update set actif=true;

  insert into public.conventions_promoteurs(
    promoteur_id,tarif_mensuel,montant_paye,date_paiement,date_expiration,statut
  )
  values(promoter_id,30000,30000,now(),current_date+30,'actif')
  on conflict(promoteur_id) do update set
    tarif_mensuel=30000,
    montant_paye=30000,
    date_paiement=now(),
    date_expiration=current_date+30,
    statut='actif'
  returning id into convention_id;

  insert into public.abonnements_promoteurs(
    convention_id,promoteur_id,debut,echeance,statut,dernier_paiement_le
  )
  values(convention_id,promoter_id,current_date,current_date+30,'actif',now())
  on conflict(promoteur_id) do update set
    convention_id=excluded.convention_id,
    echeance=current_date+30,
    statut='actif',
    dernier_paiement_le=now();

  -- Conserver un ancien abonnement pharmacie actif pour prouver que le moteur canonique ne dépend plus de lui.
  insert into public.abonnements(pharmacie_id,formule,montant_mensuel,debut,echeance,statut,dernier_paiement_le)
  values(pharmacy_id,'LEGACY_PART6',30000,current_date,current_date+30,'actif',now())
  on conflict (pharmacie_id) do update set echeance=current_date+30,statut='actif';

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub',promoter_id,'role','authenticated')::text,
    true
  );

  if not private.naxa_promoteur_valide(promoter_id) then
    raise exception 'PART6_FAIL_CANONICAL_VALIDITY_ACTIVE';
  end if;

  update public.abonnements_promoteurs
  set echeance=current_date-1, statut='impaye'
  where promoteur_id=promoter_id;

  if private.naxa_promoteur_valide(promoter_id) then
    raise exception 'PART6_FAIL_CANONICAL_EXPIRY_IGNORED';
  end if;

  if public.naxa_has_privilege('VIEW_NETWORK_PILOTAGE',null,'RESEAU') then
    raise exception 'PART6_FAIL_PRIVILEGE_ENGINE_IGNORES_CANONICAL_EXPIRY';
  end if;

  if not has_function_privilege('authenticated','public.naxa_promoteur_valide(uuid)','execute')
     or has_function_privilege('anon','public.naxa_promoteur_valide(uuid)','execute') then
    raise exception 'PART6_FAIL_PUBLIC_VALIDITY_FACADE';
  end if;

  if has_function_privilege('authenticated','public.synchroniser_validite_promoteurs()','execute')
     or has_function_privilege('authenticated','public.synchroniser_validite_pharmacies()','execute') then
    raise exception 'PART6_FAIL_MUTATING_SYNC_EXPOSED';
  end if;

  raise notice 'PART6_GREEN';
end $$;

rollback;

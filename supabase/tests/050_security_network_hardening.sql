-- NAXA — Pilotage 360° Partie 3 : test contradictoire sécurité + réseau
begin;

do $$
declare
  admin_id uuid;
  promoter_id uuid;
  ph_id uuid;
  other_ph uuid;
  convention_id uuid;
  ok boolean;
begin
  select id into admin_id from public.profiles order by created_at limit 1;
  select id into promoter_id from public.profiles order by created_at offset 1 limit 1;
  select id into ph_id from public.pharmacies order by created_at limit 1;

  if admin_id is null or promoter_id is null or ph_id is null then
    raise exception 'PART3_FIXTURE_MISSING';
  end if;

  insert into public.pharmacies(nom,ville,actif)
  values('__PART3_OTHER__','Yaoundé',true)
  returning id into other_ph;

  update public.profiles
  set role='admin',actif=true,pharmacie_id=null,parent_profile_id=null,
      fonction_interne=null,niveau_interne=null,niveau_hierarchique=0,
      architecture_code=null,custom_role_code=null
  where id=admin_id;

  update public.profiles
  set role='promoteur',actif=true,pharmacie_id=ph_id,parent_profile_id=null,
      fonction_interne='promoteur',niveau_interne=1,niveau_hierarchique=1,
      architecture_code='PARENTS_AINES_CADETS',custom_role_code=null
  where id=promoter_id;

  update public.profiles
  set role='pharmacie',actif=true,pharmacie_id=ph_id,parent_profile_id=promoter_id,
      fonction_interne='responsable',niveau_interne=2,niveau_hierarchique=2,
      architecture_code='PARENTS_AINES_CADETS',custom_role_code=null
  where id=admin_id;

  insert into public.pharmacie_architectures(
    pharmacie_id,architecture_code,assigned_by,max_responsables,max_caisses,active
  )
  values(ph_id,'PARENTS_AINES_CADETS',admin_id,5,5,true)
  on conflict(pharmacie_id) do update set
    architecture_code=excluded.architecture_code,
    assigned_by=excluded.assigned_by,
    max_responsables=5,
    max_caisses=5,
    active=true;

  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values(promoter_id,ph_id,true)
  on conflict(promoteur_id,pharmacie_id) do update set actif=true;

  insert into public.conventions_promoteurs(
    promoteur_id,tarif_mensuel,montant_paye,date_paiement,date_expiration,statut
  )
  values(promoter_id,30000,30000,now(),current_date+30,'actif')
  on conflict(promoteur_id) do update set
    date_expiration=current_date+30,statut='actif'
  returning id into convention_id;

  insert into public.abonnements_promoteurs(
    convention_id,promoteur_id,debut,echeance,statut
  )
  values(convention_id,promoter_id,current_date,current_date+30,'actif')
  on conflict(promoteur_id) do update set
    echeance=current_date+30,statut='actif',convention_id=excluded.convention_id;

  perform set_config('request.jwt.claims',json_build_object('sub',admin_id,'role','authenticated')::text,true);
  perform public.naxa_grant_privilege(promoter_id,'VIEW_NETWORK_PILOTAGE',ph_id,'RESEAU');

  perform set_config('request.jwt.claims',json_build_object('sub',promoter_id,'role','authenticated')::text,true);
  perform public.naxa_grant_privilege(admin_id,'VIEW_PERFORMANCE_PILOTAGE',ph_id,'PHARMACIE');

  select public.naxa_has_privilege('VIEW_PERFORMANCE_PILOTAGE',ph_id,'PHARMACIE') into ok;
  if not ok then raise exception 'PART3_FAIL_RESPONSIBLE_VALID_PROMOTER'; end if;

  update public.abonnements_promoteurs
  set echeance=current_date-1,statut='impaye'
  where promoteur_id=promoter_id;

  if public.naxa_has_privilege('VIEW_PERFORMANCE_PILOTAGE',ph_id,'PHARMACIE') then
    raise exception 'PART3_FAIL_EXPIRED_PROMOTER_STILL_AUTHORIZED';
  end if;

  update public.profiles
  set role='admin',actif=true,pharmacie_id=null,parent_profile_id=null,
      fonction_interne=null,niveau_interne=null,niveau_hierarchique=0,
      architecture_code=null,custom_role_code=null
  where id=admin_id;

  perform set_config('request.jwt.claims',json_build_object('sub',admin_id,'role','authenticated')::text,true);

  begin
    perform public.naxa_grant_privilege(promoter_id,'VIEW_NETWORK_PILOTAGE',other_ph,'RESEAU');
    raise exception 'PART3_FAIL_NETWORK_GRANT_OUTSIDE_NETWORK';
  exception when others then
    if sqlerrm='PART3_FAIL_NETWORK_GRANT_OUTSIDE_NETWORK' then raise; end if;
  end;

  if has_function_privilege('anon','public.naxa_grant_privilege(uuid,text,uuid,text)','execute') then
    raise exception 'PART3_FAIL_GRANT_ANON';
  end if;

  if has_function_privilege('anon','public.naxa_revoke_privilege(uuid,text,uuid,text)','execute') then
    raise exception 'PART3_FAIL_REVOKE_ANON';
  end if;

  raise notice 'PART3_SECURITY_NETWORK_GREEN';
end $$;

rollback;

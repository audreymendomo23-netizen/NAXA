-- NAXA — Partie 5 : test contradictoire scope réseau + pilotage Promoteur
begin;

do $$
declare
  admin_id uuid;
  promoter_id uuid;
  ph1 uuid;
  ph2 uuid;
  v jsonb;
begin
  select id into admin_id from public.profiles order by created_at limit 1;
  select id into promoter_id from public.profiles order by created_at desc limit 1;
  select id into ph1 from public.pharmacies order by created_at limit 1;

  if admin_id=promoter_id then raise exception 'PART5_FIXTURE_NEEDS_TWO_PROFILES'; end if;

  insert into public.pharmacies(nom,ville,quartier,adresse,lat,lng,actif,est_demo,visible_recherche)
  values('__PART5_TEST_UNRELATED__','Yaoundé','TEST','TEST',3.8667,11.5167,true,true,false)
  returning id into ph2;

  update public.profiles
  set role='admin',niveau_hierarchique=0,pharmacie_id=null,fonction_interne=null,
      niveau_interne=null,parent_profile_id=null,architecture_code=null,
      custom_role_code=null,actif=true
  where id=admin_id;

  update public.profiles
  set role='promoteur',niveau_hierarchique=1,pharmacie_id=ph1,
      fonction_interne='promoteur',niveau_interne=1,parent_profile_id=null,
      architecture_code='ORPHELIN',custom_role_code=null,actif=true
  where id=promoter_id;

  insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,max_responsables,max_caisses,active)
  values(ph1,'ORPHELIN',admin_id,0,1,true)
  on conflict(pharmacie_id) do update
  set architecture_code='ORPHELIN',assigned_by=admin_id,max_responsables=0,max_caisses=1,active=true;

  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values(promoter_id,ph1,true)
  on conflict(promoteur_id,pharmacie_id) do update set actif=true;

  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values(promoter_id,ph2,false)
  on conflict(promoteur_id,pharmacie_id) do update set actif=false;

  insert into public.conventions_promoteurs(promoteur_id,tarif_mensuel,montant_paye,date_paiement,date_expiration,statut)
  values(promoter_id,0,0,now(),current_date+30,'actif')
  on conflict(promoteur_id) do update
  set statut='actif',date_expiration=current_date+30,montant_paye=0,date_paiement=now();

  insert into public.abonnements_promoteurs(convention_id,promoteur_id,debut,echeance,statut,dernier_paiement_le)
  select c.id,promoter_id,current_date,current_date+30,'actif',now()
  from public.conventions_promoteurs c where c.promoteur_id=promoter_id
  on conflict(promoteur_id) do update set statut='actif',echeance=current_date+30;

  perform set_config('request.jwt.claims',json_build_object('sub',admin_id,'role','authenticated')::text,true);
  perform public.naxa_grant_privilege(promoter_id,'VIEW_NETWORK_PILOTAGE',ph1,'RESEAU');

  if not exists(
    select 1 from public.naxa_profile_privileges
    where profile_id=promoter_id
      and privilege_code='VIEW_NETWORK_PILOTAGE'
      and pharmacie_id is null
      and scope_type='RESEAU'
      and active
  ) then
    raise exception 'PART5_FAIL_NETWORK_GRANT_PERSISTENCE';
  end if;

  perform set_config('request.jwt.claims',json_build_object('sub',promoter_id,'role','authenticated')::text,true);

  if not public.naxa_has_privilege('VIEW_NETWORK_PILOTAGE',null,'RESEAU') then
    raise exception 'PART5_FAIL_NETWORK_PRIVILEGE_NOT_EFFECTIVE';
  end if;

  v:=public.stats_pilotage_scope(7);

  if v->>'role' <> 'promoteur' then
    raise exception 'PART5_FAIL_ROLE';
  end if;

  if (v->'pharmacies'->>'total')::int <> 1 then
    raise exception 'PART5_FAIL_SCOPE_LEAK_EXPECTED_1_GOT_%',(v->'pharmacies'->>'total');
  end if;

  -- Aucune pharmacie hors réseau actif ne doit entrer dans le scope.
  if exists(
    select 1
    from public.promoteur_pharmacies pp
    where pp.promoteur_id=promoter_id and pp.pharmacie_id=ph2 and pp.actif
  ) then
    raise exception 'PART5_FAIL_INACTIVE_LINK_BECAME_ACTIVE';
  end if;

  -- Le Promoteur ne doit pas pouvoir attribuer un scope RESEAU à une autre cible.
  begin
    perform public.naxa_grant_privilege(promoter_id,'VIEW_NETWORK_PILOTAGE',ph1,'RESEAU');
    raise exception 'PART5_FAIL_PROMOTEUR_SELF_GRANT_NETWORK';
  exception when others then
    if sqlerrm='PART5_FAIL_PROMOTEUR_SELF_GRANT_NETWORK' then raise; end if;
  end;

  -- Le scope RESEAU reste gouverné par NAXA : seul l'Admin peut le révoquer.
  perform set_config('request.jwt.claims',json_build_object('sub',admin_id,'role','authenticated')::text,true);
  perform public.naxa_revoke_privilege(promoter_id,'VIEW_NETWORK_PILOTAGE',ph1,'RESEAU');

  if exists(
    select 1 from public.naxa_profile_privileges
    where profile_id=promoter_id
      and privilege_code='VIEW_NETWORK_PILOTAGE'
      and pharmacie_id is null
      and scope_type='RESEAU'
      and active
  ) then
    raise exception 'PART5_FAIL_NETWORK_REVOKE';
  end if;

  perform set_config('request.jwt.claims',json_build_object('sub',promoter_id,'role','authenticated')::text,true);
  if public.naxa_has_privilege('VIEW_NETWORK_PILOTAGE',null,'RESEAU') then
    raise exception 'PART5_FAIL_REVOKED_NETWORK_STILL_EFFECTIVE';
  end if;

  begin
    perform public.stats_pilotage_scope(7);
    raise exception 'PART5_FAIL_REVOKED_PILOTAGE_STILL_ACCESSIBLE';
  exception when others then
    if sqlerrm='PART5_FAIL_REVOKED_PILOTAGE_STILL_ACCESSIBLE' then raise; end if;
  end;

  perform set_config('request.jwt.claims',json_build_object('sub',admin_id,'role','authenticated')::text,true);
  perform public.naxa_grant_privilege(promoter_id,'VIEW_NETWORK_PILOTAGE',ph1,'RESEAU');

  perform set_config('request.jwt.claims',json_build_object('sub',promoter_id,'role','authenticated')::text,true);
  if not public.naxa_has_privilege('VIEW_NETWORK_PILOTAGE',null,'RESEAU') then
    raise exception 'PART5_FAIL_NETWORK_REACTIVATION';
  end if;

  raise notice 'PART5_GREEN';
end $$;

rollback;
-- NAXA 027 — validation Partie 2 Promoteur : architecture + convention + validité
-- Transactionnel : aucune donnée de test ne persiste.

begin;
do $$
declare
  v_promoteur uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_other uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_a uuid := '00000000-0000-0000-0000-000000000001';
  v_b uuid := '00000000-0000-0000-0000-000000000002';
  v_arch_a text;
  v_ok boolean;
begin
  set local session_replication_role='replica';

  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,email_confirmed_at,created_at,updated_at,is_sso_user,is_anonymous)
  values(v_promoteur,'authenticated','authenticated','naxa.promoteur.p2@example.invalid','{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now(),now(),false,false)
  on conflict(id) do nothing;

  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,email_confirmed_at,created_at,updated_at,is_sso_user,is_anonymous)
  values(v_other,'authenticated','authenticated','naxa.promoteur.p2.other@example.invalid','{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now(),now(),false,false)
  on conflict(id) do nothing;

  insert into public.pharmacies(id,nom,ville,lat,lng,slug,est_demo)
  values
    (v_a,'NAXA Test 027 A','Yaoundé',3.8550,11.5090,'naxa-test-027-a',false),
    (v_b,'NAXA Test 027 B','Yaoundé',3.8560,11.5100,'naxa-test-027-b',false)
  on conflict(id) do nothing;

  set local session_replication_role='origin';

  insert into public.profiles(id,role,actif,fonction_interne,niveau_interne,niveau_hierarchique,architecture_code)
  values(v_promoteur,'promoteur',true,'promoteur',1,1,'PARENTS_AINES_CADETS')
  on conflict(id) do update set role='promoteur',actif=true,fonction_interne='promoteur',niveau_interne=1,niveau_hierarchique=1,architecture_code='PARENTS_AINES_CADETS';

  insert into public.profiles(id,role,actif,fonction_interne,niveau_interne,niveau_hierarchique,architecture_code)
  values(v_other,'promoteur',true,'promoteur',1,1,'PARENTS_AINES_CADETS')
  on conflict(id) do update set role='promoteur',actif=true,fonction_interne='promoteur',niveau_interne=1,niveau_hierarchique=1,architecture_code='PARENTS_AINES_CADETS';

  insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses)
  values(v_a,'PARENTS_AINES_CADETS',v_promoteur,true,5,5)
  on conflict(pharmacie_id) do update set architecture_code=excluded.architecture_code,active=true,max_responsables=5,max_caisses=5;

  set local session_replication_role='replica';
  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values(v_promoteur,v_a,true)
  on conflict(promoteur_id,pharmacie_id) do update set actif=true;
  set local session_replication_role='origin';

  insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut)
  values(v_promoteur,30000,current_date+30,'active')
  on conflict(promoteur_id) do update set montant_mensuel=30000,date_expiration=current_date+30,statut='active';

  insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut)
  select v_promoteur,id,30000,current_date,current_date+30,'actif'
  from public.conventions_promoteurs where promoteur_id=v_promoteur
  on conflict(promoteur_id) do update set convention_id=excluded.convention_id,montant_mensuel=30000,debut=current_date,echeance=current_date+30,statut='actif';

  if not public.naxa_promoteur_valide(v_promoteur) then raise exception 'validité active refusée'; end if;
  perform public.naxa_provision_promoteur_pharmacie(v_promoteur,v_a);

  perform set_config('request.jwt.claim.sub',v_promoteur::text,true);
  if not public.naxa_can('VIEW_PHARMACY',v_a,null) then raise exception 'Promoteur valide refusé par naxa_can'; end if;

  update public.conventions_promoteurs
  set date_expiration=current_date-1,statut='expiree'
  where promoteur_id=v_promoteur;
  update public.abonnements_promoteurs
  set echeance=current_date-1,statut='impaye'
  where promoteur_id=v_promoteur;
  if public.naxa_promoteur_valide(v_promoteur) then raise exception 'validité expirée encore acceptée'; end if;

  update public.conventions_promoteurs
  set date_expiration=current_date+30,statut='active';
  update public.abonnements_promoteurs
  set echeance=current_date+30,statut='actif';

  if not public.naxa_promoteur_valide(v_promoteur) then raise exception 'réactivation de validité refusée'; end if;

  insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut)
  values(v_other,30000,current_date+30,'active')
  on conflict(promoteur_id) do update set montant_mensuel=30000,date_expiration=current_date+30,statut='active';

  begin
    insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut)
    select v_promoteur,c.id,30000,current_date,current_date+30,'actif'
    from public.conventions_promoteurs c where c.promoteur_id=v_other;
    raise exception 'abonnement croisé accepté';
  exception when others then
    if position('incohérente' in sqlerrm)=0 then
      raise exception 'mauvaise erreur sur convention croisée: %',sqlerrm;
    end if;
  end;

  update public.pharmacie_architectures
  set architecture_code='PARENTS_ENFANTS',max_responsables=0,max_caisses=5
  where pharmacie_id=v_a;
  if exists(select 1 from public.naxa_architecture_privileges where architecture_code='PARENTS_ENFANTS' and role_key='promoteur' and privilege_code='CREATE_RESPONSABLE') then
    raise exception 'A2 expose CREATE_RESPONSABLE';
  end if;

  update public.pharmacie_architectures
  set architecture_code='PARENTS_AINES_CADETS',max_responsables=5,max_caisses=5
  where pharmacie_id=v_a;
  if not exists(select 1 from public.naxa_architecture_privileges where architecture_code='PARENTS_AINES_CADETS' and role_key='promoteur' and privilege_code='CREATE_RESPONSABLE') then
    raise exception 'A3 n expose pas CREATE_RESPONSABLE';
  end if;

  -- La validité doit bloquer le moteur de privilèges, sans supprimer le lien réseau.
  select public.naxa_can('VIEW_PHARMACY',v_a,null) into v_ok;
  if not v_ok then raise exception 'Promoteur valide refusé par naxa_can'; end if;

  update public.conventions_promoteurs set date_expiration=current_date-1,statut='expiree' where promoteur_id=v_promoteur;
  update public.abonnements_promoteurs set echeance=current_date-1,statut='impaye' where promoteur_id=v_promoteur;
  select public.naxa_can('VIEW_PHARMACY',v_a,null) into v_ok;
  if v_ok then raise exception 'Promoteur invalide encore autorisé par naxa_can'; end if;

  begin
    perform public.naxa_provision_promoteur_pharmacie(v_promoteur,v_a);
    raise exception 'provisioning Promoteur invalide encore accepté';
  exception when others then
    if position('commercialement invalide' in sqlerrm)=0 then raise; end if;
  end;

  if not public.naxa_scope_allows(v_promoteur,v_a,'PHARMACIE') then
    raise exception 'le scope réseau a été cassé par la validité';
  end if;
end $$;

select 'GREEN' as status, 11 as assertions;
rollback;

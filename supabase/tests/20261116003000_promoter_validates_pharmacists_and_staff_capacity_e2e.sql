-- E2E capacité équipe pharmacie et séparation effectifs / architecture / comptabilité.
-- Crée 14 profils métier éphémères sur deux pharmacies d'un même Promoteur.
-- Toutes les écritures sont annulées par ROLLBACK.
begin;

create temporary table naxa_team_capacity_results(
  test text primary key,
  ok boolean not null,
  detail text not null
) on commit drop;

do $test$
declare
  v_promoter uuid:='b5b79627-46ac-4dea-8ea9-6f0464cb3404';
  v_pharmacy_a uuid:='76dd4983-273a-4a83-ae3d-9a7838d3aa35';
  v_pharmacy_b uuid:='86bfc15b-0737-4656-ab72-0a199acb8b1f';
  v_now timestamptz:=now();
  v_role text;
  v_staff uuid;
  v_assignment uuid;
  v_i integer;
  v_cashiers uuid[]:=array[]::uuid[];
  v_stock uuid[]:=array[]::uuid[];
  v_accountants uuid[]:=array[]::uuid[];
  v_couriers uuid[]:=array[]::uuid[];
  v_responsable_a uuid:=gen_random_uuid();
  v_responsable_a_2 uuid:=gen_random_uuid();
  v_responsable_b uuid:=gen_random_uuid();
  v_rejected boolean:=false;
  v_count integer;
  v_architecture_before text;
  v_max_cashiers_before integer;
  v_max_responsables_before integer;
  v_level_count_before integer;
  v_compta_ecriture_before bigint;
  v_compta_ligne_before bigint;
  v_compta_evenement_before bigint;
  v_compta_droits_before bigint;
  v_ventes_before bigint;
  v_vente_lignes_before bigint;
  v_architecture_after text;
  v_max_cashiers_after integer;
  v_max_responsables_after integer;
  v_level_count_after integer;
begin
  if not private.naxa_promoteur_valide(v_promoter)
     or not exists(select 1 from public.promoteur_pharmacies
       where promoteur_id=v_promoter and pharmacie_id=v_pharmacy_a and actif)
     or not exists(select 1 from public.promoteur_pharmacies
       where promoteur_id=v_promoter and pharmacie_id=v_pharmacy_b and actif) then
    raise exception 'Le Promoteur E2E doit gérer activement les deux pharmacies';
  end if;

  if (select count(*) from public.naxa_professional_assignments
      where pharmacie_id=v_pharmacy_a and role_code='responsable'
        and statut='active' and commence_at<=now()
        and (expire_at is null or expire_at>now()))<>0
     or (select count(*) from public.naxa_professional_assignments
      where pharmacie_id=v_pharmacy_b and role_code='responsable'
        and statut='active' and commence_at<=now()
        and (expire_at is null or expire_at>now()))<>0 then
    raise exception 'Les pharmacies de recette doivent être libres de Responsable pour cette recette';
  end if;

  select architecture_code,max_caisses,max_responsables
    into v_architecture_before,v_max_cashiers_before,v_max_responsables_before
  from public.pharmacie_architectures
  where pharmacie_id=v_pharmacy_a and active=true;
  select count(*) into v_level_count_before
  from public.naxa_architecture_niveaux where architecture_code=v_architecture_before;

  select count(*) into v_compta_ecriture_before from public.compta_ecriture;
  select count(*) into v_compta_ligne_before from public.compta_ligne;
  select count(*) into v_compta_evenement_before from public.compta_evenement;
  select count(*) into v_compta_droits_before from public.compta_droits_ecriture;
  select count(*) into v_ventes_before from public.ventes;
  select count(*) into v_vente_lignes_before from public.vente_lignes;

  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at)
  values
    (v_responsable_a,'authenticated','authenticated','naxa-team-'||replace(v_responsable_a::text,'-','')||'@example.invalid','',v_now,
      '{}'::jsonb,jsonb_build_object('username','naxateamresp'||substr(replace(v_responsable_a::text,'-',''),1,8),'naxa_signup_pending',true),false,v_now,v_now),
    (v_responsable_a_2,'authenticated','authenticated','naxa-team-'||replace(v_responsable_a_2::text,'-','')||'@example.invalid','',v_now,
      '{}'::jsonb,jsonb_build_object('username','naxateamresp2'||substr(replace(v_responsable_a_2::text,'-',''),1,8),'naxa_signup_pending',true),false,v_now,v_now),
    (v_responsable_b,'authenticated','authenticated','naxa-team-'||replace(v_responsable_b::text,'-','')||'@example.invalid','',v_now,
      '{}'::jsonb,jsonb_build_object('username','naxateamresp3'||substr(replace(v_responsable_b::text,'-',''),1,8),'naxa_signup_pending',true),false,v_now,v_now);

  insert into public.profiles(id,role,username,actif)
  values
    (v_responsable_a,'client','naxateamresp'||substr(replace(v_responsable_a::text,'-',''),1,8),true),
    (v_responsable_a_2,'client','naxateamresp2'||substr(replace(v_responsable_a_2::text,'-',''),1,8),true),
    (v_responsable_b,'client','naxateamresp3'||substr(replace(v_responsable_b::text,'-',''),1,8),true);

  perform set_config('request.jwt.claim.sub',v_promoter::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_promoter::text,'role','authenticated')::text,true);

  -- 3 personnes distinctes par fonction : ces affectations ne créent pas de caisses,
  -- de niveaux hiérarchiques, de comptes ou de lignes comptables.
  foreach v_role in array array['caisse','gestionnaire_stock','comptable','livreur'] loop
    for v_i in 1..3 loop
      v_staff:=gen_random_uuid();
      insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,
        raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at)
      values(v_staff,'authenticated','authenticated',
        'naxa-team-'||replace(v_staff::text,'-','')||'@example.invalid','',v_now,
        '{}'::jsonb,
        jsonb_build_object('username','naxateam'||substr(replace(v_staff::text,'-',''),1,12),'naxa_signup_pending',true),
        false,v_now,v_now);
      insert into public.profiles(id,role,username,actif)
      values(v_staff,'client','naxateam'||substr(replace(v_staff::text,'-',''),1,12),true);

      v_assignment:=public.naxa_grant_professional_assignment(
        v_staff,v_pharmacy_a,v_role,v_now,null,
        'Recette multiplicité effectifs '||v_role||' numéro '||v_i
      );
      if v_assignment is null then raise exception 'Aucune affectation créée pour %',v_role; end if;

      if v_role='caisse' then v_cashiers:=array_append(v_cashiers,v_staff); end if;
      if v_role='gestionnaire_stock' then v_stock:=array_append(v_stock,v_staff); end if;
      if v_role='comptable' then v_accountants:=array_append(v_accountants,v_staff); end if;
      if v_role='livreur' then v_couriers:=array_append(v_couriers,v_staff); end if;
    end loop;
  end loop;

  if cardinality(v_cashiers)<>3 or cardinality(v_stock)<>3
     or cardinality(v_accountants)<>3 or cardinality(v_couriers)<>3 then
    raise exception 'Le lot de recette n''a pas créé trois profils par fonction';
  end if;

  select count(*) into v_count from public.naxa_professional_assignments
  where profile_id=any(v_cashiers) and pharmacie_id=v_pharmacy_a
    and role_code='caisse' and statut='active';
  if v_count<>3 then raise exception 'Trois Caissières indépendantes ne sont pas affectées'; end if;
  insert into naxa_team_capacity_results values('trois_caissieres',true,
    'Trois comptes distincts portent le poste Caisse dans une pharmacie disposant de max_caisses=1');

  select count(*) into v_count from public.naxa_professional_assignments
  where profile_id=any(v_stock) and pharmacie_id=v_pharmacy_a
    and role_code='gestionnaire_stock' and statut='active';
  if v_count<>3 then raise exception 'Trois Gestionnaires de stock ne sont pas affectés'; end if;
  insert into naxa_team_capacity_results values('trois_gestionnaires_stock',true,
    'Trois comptes distincts portent le poste Gestionnaire de stock');

  select count(*) into v_count from public.naxa_professional_assignments
  where profile_id=any(v_accountants) and pharmacie_id=v_pharmacy_a
    and role_code='comptable' and statut='active';
  if v_count<>3 then raise exception 'Trois Comptables ne sont pas affectés'; end if;
  insert into naxa_team_capacity_results values('trois_comptables',true,
    'Trois comptes distincts portent le poste Comptable sans créer automatiquement d''écritures');

  select count(*) into v_count from public.naxa_professional_assignments
  where profile_id=any(v_couriers) and pharmacie_id=v_pharmacy_a
    and role_code='livreur' and statut='active';
  if v_count<>3 then raise exception 'Trois Livreurs ne sont pas affectés'; end if;
  insert into naxa_team_capacity_results values('trois_livreurs',true,
    'Trois comptes distincts portent le poste Livreur');

  -- Un seul Responsable simultané dans chaque pharmacie, et non un seul par Promoteur.
  perform public.naxa_grant_professional_assignment(
    v_responsable_a,v_pharmacy_a,'responsable',v_now,null,'Responsable principal Pharmacie A'
  );
  v_rejected:=false;
  begin
    perform public.naxa_grant_professional_assignment(
      v_responsable_a_2,v_pharmacy_a,'responsable',v_now,null,'Second Responsable interdit'
    );
  exception when others then
    v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Une pharmacie a accepté deux Responsables actifs'; end if;
  insert into naxa_team_capacity_results values('un_responsable_maximum_par_pharmacie',true,
    'La deuxième affectation Responsable est refusée, même si le compte cible est différent');

  perform public.naxa_grant_professional_assignment(
    v_responsable_b,v_pharmacy_b,'responsable',v_now,null,'Responsable principal Pharmacie B'
  );
  if not exists(select 1 from public.naxa_professional_assignments
    where profile_id=v_responsable_b and pharmacie_id=v_pharmacy_b
      and role_code='responsable' and statut='active') then
    raise exception 'Le Promoteur ne peut pas affecter un Responsable à sa deuxième pharmacie';
  end if;
  insert into naxa_team_capacity_results values('promoteur_multipharmacie',true,
    'Le même Promoteur gère deux pharmacies indépendantes, chacune avec un seul Responsable');

  -- Le rôle actif est indépendant sur chaque compte, pour toutes les fonctions multiples.
  perform set_config('request.jwt.claim.sub',v_cashiers[1]::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_cashiers[1],'role','authenticated')::text,true);
  perform public.naxa_select_active_role('caisse',v_pharmacy_a);
  if private.naxa_business_function(v_cashiers[1])<>'caisse' then raise exception 'Le compte Caissière ne résout pas son rôle actif'; end if;

  perform set_config('request.jwt.claim.sub',v_stock[1]::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_stock[1],'role','authenticated')::text,true);
  perform public.naxa_select_active_role('gestionnaire_stock',v_pharmacy_a);
  if private.naxa_business_function(v_stock[1])<>'gestionnaire_stock' then raise exception 'Le compte Gestionnaire de stock ne résout pas son rôle actif'; end if;

  perform set_config('request.jwt.claim.sub',v_accountants[1]::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_accountants[1],'role','authenticated')::text,true);
  perform public.naxa_select_active_role('comptable',v_pharmacy_a);
  if private.naxa_business_function(v_accountants[1])<>'comptable' then raise exception 'Le compte Comptable ne résout pas son rôle actif'; end if;

  perform set_config('request.jwt.claim.sub',v_couriers[1]::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_couriers[1],'role','authenticated')::text,true);
  perform public.naxa_select_active_role('livreur',v_pharmacy_a);
  if private.naxa_business_function(v_couriers[1])<>'livreur' then raise exception 'Le compte Livreur ne résout pas son rôle actif'; end if;
  insert into naxa_team_capacity_results values('roles_autonomes_et_selection',true,
    'Les quatre profils testés sélectionnent chacun leur poste sans modifier les autres comptes');

  -- Les affectations d'équipe ne changent aucun niveau, quota d'architecture ou compteur financier.
  select architecture_code,max_caisses,max_responsables
    into v_architecture_after,v_max_cashiers_after,v_max_responsables_after
  from public.pharmacie_architectures
  where pharmacie_id=v_pharmacy_a and active=true;
  select count(*) into v_level_count_after
  from public.naxa_architecture_niveaux where architecture_code=v_architecture_after;
  if v_architecture_after is distinct from v_architecture_before
     or v_max_cashiers_after is distinct from v_max_cashiers_before
     or v_max_responsables_after is distinct from v_max_responsables_before
     or v_level_count_after is distinct from v_level_count_before then
    raise exception 'Une affectation de personnel a modifié l''architecture ou ses plafonds';
  end if;
  insert into naxa_team_capacity_results values('architecture_non_biaisee',true,
    'Code architecture, max_caisses, max_responsables et nombre de niveaux restent strictement identiques');

  if (select count(*) from public.compta_ecriture)<>v_compta_ecriture_before
     or (select count(*) from public.compta_ligne)<>v_compta_ligne_before
     or (select count(*) from public.compta_evenement)<>v_compta_evenement_before
     or (select count(*) from public.compta_droits_ecriture)<>v_compta_droits_before
     or (select count(*) from public.ventes)<>v_ventes_before
     or (select count(*) from public.vente_lignes)<>v_vente_lignes_before then
    raise exception 'Les affectations de personnel ont modifié une écriture, un droit comptable ou une vente';
  end if;
  insert into naxa_team_capacity_results values('comptabilite_et_chiffres_isoles',true,
    'Les affectations ne créent aucune écriture, ligne, événement, droit d''écriture ni vente');

  -- L'accès en écriture est une délégation explicite et séparée pour chacun des Comptables.
  perform set_config('request.jwt.claim.sub',v_promoter::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_promoter::text,'role','authenticated')::text,true);
  select count(*) into v_count from public.compta_promoteur_lister_comptables(v_pharmacy_a) c
    where c.comptable_id=any(v_accountants);
  if v_count<>3 then raise exception 'Le Promoteur ne retrouve pas ses trois Comptables dans le gestionnaire de droits'; end if;
  for v_i in 1..3 loop
    perform public.compta_promoteur_configurer_ecriture(v_pharmacy_a,v_accountants[v_i],true);
  end loop;
  if (select count(*) from public.compta_droits_ecriture
      where pharmacie_id=v_pharmacy_a and comptable_id=any(v_accountants) and autorise)<>3 then
    raise exception 'Les trois droits d''écriture Comptable n''ont pas été créés individuellement';
  end if;

  for v_i in 1..3 loop
    perform set_config('request.jwt.claim.sub',v_accountants[v_i]::text,true);
    perform set_config('request.jwt.claims',json_build_object('sub',v_accountants[v_i],'role','authenticated')::text,true);
    perform public.naxa_select_active_role('comptable',v_pharmacy_a);
    if public.naxa_business_function(v_accountants[v_i])<>'comptable'
       or not public.naxa_has_privilege('MANAGE_ACCOUNTING',v_pharmacy_a,'PHARMACIE') then
      raise exception 'Le Comptable % ne reçoit pas son droit d''écriture sur son poste actif',v_i;
    end if;
  end loop;
  insert into naxa_team_capacity_results values('trois_droits_comptables_individuels',true,
    'Le Promoteur délègue séparément les droits d''écriture et chacun des trois comptes les reçoit sur son périmètre');

  if (select count(*) from public.compta_ecriture)<>v_compta_ecriture_before
     or (select count(*) from public.compta_ligne)<>v_compta_ligne_before
     or (select count(*) from public.compta_evenement)<>v_compta_evenement_before
     or (select count(*) from public.ventes)<>v_ventes_before
     or (select count(*) from public.vente_lignes)<>v_vente_lignes_before then
    raise exception 'Le partage du droit d''écriture a créé une opération ou une écriture financière';
  end if;
  insert into naxa_team_capacity_results values('droits_comptables_sans_ecriture_financiere',true,
    'Le partage des droits laisse intacts le journal, les événements financiers et les ventes');

end;
$test$;

select * from naxa_team_capacity_results order by test;
rollback;

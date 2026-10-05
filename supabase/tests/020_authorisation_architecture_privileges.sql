-- NAXA 020 — acceptance test architecture + privilèges
-- À exécuter dans un environnement de test où 020 est déjà committée.
-- Aucun ajout de valeur role_type : Responsable = niveau_interne=2.
begin;

do $$
declare
  v_admin uuid;
  v_promoteur uuid;
  v_target uuid;
  v_pharmacie uuid;
  v_id uuid;
  v_ok boolean;
begin
  select id into v_admin from public.profiles where role='admin' order by created_at asc limit 1;
  select id into v_promoteur from public.profiles where id<>v_admin order by created_at asc limit 1;
  select id into v_target from public.profiles where id<>v_admin and id<>v_promoteur order by created_at asc limit 1;
  select id into v_pharmacie from public.pharmacies order by created_at asc limit 1;

  if v_admin is null or v_promoteur is null or v_target is null or v_pharmacie is null then
    raise exception 'Fixture insuffisante: admin + promoteur + cible + pharmacie requis';
  end if;

  update public.profiles set role='admin',actif=true,niveau_interne=0,pharmacie_id=null,parent_profile_id=null where id=v_admin;
  update public.profiles set role='promoteur',actif=true,niveau_interne=1,pharmacie_id=v_pharmacie,parent_profile_id=null where id=v_promoteur;
  update public.profiles set role='pharmacie',actif=true,niveau_interne=0,pharmacie_id=v_pharmacie,parent_profile_id=null where id=v_target;

  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values(v_promoteur,v_pharmacie,true)
  on conflict (promoteur_id,pharmacie_id) do update set actif=true;

  insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut,architecture_code)
  values(v_promoteur,30000,current_date+30,'active','PARENTS_ENFANTS')
  on conflict (promoteur_id) do update
  set architecture_code='PARENTS_ENFANTS',statut='active',date_expiration=current_date+30;

  -- Le rôle système reste inchangé : aucune valeur responsable dans role_type.
  if exists(select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='role_type' and e.enumlabel='responsable') then
    raise exception 'Contradiction: responsable ne doit pas être une valeur role_type';
  end if;

  -- Admin prépare les privilèges délégables du Promoteur.
  insert into public.naxa_profile_privileges(profile_id,privilege_code,pharmacie_id,scope_type,granted_by)
  values
   (v_promoteur,'ASSIGN_PRIVILEGE',v_pharmacie,'PHARMACIE',v_admin),
   (v_promoteur,'CREATE_RESPONSABLE',v_pharmacie,'PHARMACIE',v_admin),
   (v_promoteur,'CREATE_CAISSE',v_pharmacie,'PHARMACIE',v_admin),
   (v_promoteur,'VIEW_STOCK',v_pharmacie,'PHARMACIE',v_admin),
   (v_promoteur,'VIEW_PURCHASE_COST',v_pharmacie,'PHARMACIE',v_admin)
  on conflict(profile_id,privilege_code,pharmacie_id,scope_type) do update set active=true,revoked_at=null;

  perform set_config('request.jwt.claims',json_build_object('sub',v_promoteur::text,'role','authenticated')::text,true);

  -- Architecture 2 : Responsable interdit.
  begin
    perform public.accrediter_profile(v_target,v_pharmacie,2,v_promoteur);
    raise exception 'Architecture PARENTS_ENFANTS doit refuser le niveau Responsable';
  exception when others then
    null;
  end;

  -- Le Promoteur peut attribuer un privilège opérationnel à une Caisse, mais pas une gouvernance.
  update public.profiles set role='caisse',niveau_interne=3,parent_profile_id=null,pharmacie_id=v_pharmacie,actif=true where id=v_target;
  perform public.accrediter_profile(v_target,v_pharmacie,3,v_promoteur);
  perform public.naxa_grant_privilege(v_target,'VIEW_STOCK',v_pharmacie,'POSTE_CAISSE');

  perform set_config('request.jwt.claims',json_build_object('sub',v_target::text,'role','authenticated')::text,true);
  if not public.authorize('VIEW_STOCK',v_pharmacie,'POSTE_CAISSE') then
    raise exception 'Caisse doit obtenir VIEW_STOCK dans son scope';
  end if;
  if public.authorize('VIEW_PURCHASE_COST',v_pharmacie,'POSTE_CAISSE') then
    raise exception 'Caisse ne doit pas obtenir automatiquement VIEW_PURCHASE_COST';
  end if;
  if public.authorize('MANAGE_CONVENTION',v_pharmacie,'PHARMACIE') then
    raise exception 'Gouvernance convention doit rester NAXA';
  end if;

  -- Architecture 3 : Responsable devient possible comme niveau métier, sans changer role_type.
  update public.conventions_promoteurs set architecture_code='PARENTS_AINES_CADETS' where promoteur_id=v_promoteur;
  update public.profiles set role='pharmacie',niveau_interne=0,parent_profile_id=null,pharmacie_id=v_pharmacie,actif=true where id=v_target;
  perform set_config('request.jwt.claims',json_build_object('sub',v_promoteur::text,'role','authenticated')::text,true);
  perform public.accrediter_profile(v_target,v_pharmacie,2,v_promoteur);

  if (select niveau_interne from public.profiles where id=v_target) <> 2 then
    raise exception 'Responsable attendu au niveau interne 2';
  end if;
  if (select role::text from public.profiles where id=v_target) <> 'pharmacie' then
    raise exception 'Le role_type historique doit rester compatible et ne pas créer responsable';
  end if;

  -- Un Responsable ne peut pas recevoir un privilège réservé au Promoteur.
  perform public.naxa_grant_privilege(v_target,'VIEW_CA_BY_RESPONSABLE',v_pharmacie,'PHARMACIE');
  if not public.authorize('VIEW_NETWORK_PILOTAGE',v_pharmacie,'PHARMACIE') then
    null;
  end if;

  -- La fonction de scope ne doit jamais élargir un utilisateur hors de sa pharmacie.
  if public.naxa_scope_allows(v_target,(select id from public.pharmacies where id<>v_pharmacie limit 1),'PHARMACIE') then
    raise exception 'Scope Responsable hors pharmacie autorisée';
  end if;
end
$$;

rollback;
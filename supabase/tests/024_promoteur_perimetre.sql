-- NAXA 024 — acceptance Promoteur complet
-- Transaction rollback obligatoire. Aucun compte, lien ou privilège ne persiste.

begin;

do $naxa$
declare
  v_promoteur uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_responsable uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_caisse uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_other uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  v_a uuid := '00000000-0000-0000-0000-000000000001';
  v_b uuid := '00000000-0000-0000-0000-000000000002';
  v_c uuid := '00000000-0000-0000-0000-000000000003';
  v_arch text;
  v_rejected boolean;
begin
  -- Comptes temporaires uniquement dans la transaction.
  set local session_replication_role='replica';
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,email_confirmed_at,created_at,updated_at,is_sso_user,is_anonymous)
  values
   (v_promoteur,'authenticated','authenticated','naxa.promoteur.test@example.invalid','{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now(),now(),false,false),
   (v_responsable,'authenticated','authenticated','naxa.responsable.test@example.invalid','{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now(),now(),false,false),
   (v_caisse,'authenticated','authenticated','naxa.caisse.test@example.invalid','{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now(),now(),false,false),
   (v_other,'authenticated','authenticated','naxa.other.test@example.invalid','{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now(),now(),false,false)
  on conflict(id) do nothing;
  set local session_replication_role='origin';

  insert into public.profiles(id,role,first_name,last_name,actif,fonction_interne,niveau_interne,niveau_hierarchique,architecture_code)
  values
   (v_promoteur,'promoteur','Promoteur','Test',true,null,1,1,'PARENTS_AINES_CADETS'),
   (v_responsable,'pharmacie','Responsable','Test',true,'responsable',2,2,'PARENTS_AINES_CADETS'),
   (v_caisse,'caisse','Caisse','Test',true,null,3,3,'PARENTS_AINES_CADETS'),
   (v_other,'pharmacie','Other','Test',true,null,4,null,null)
  on conflict(id) do update set role=excluded.role,actif=true,fonction_interne=excluded.fonction_interne,niveau_interne=excluded.niveau_interne,niveau_hierarchique=excluded.niveau_hierarchique,architecture_code=excluded.architecture_code;

  insert into public.pharmacies(id,nom,lat,lng,est_demo)
  values
   (v_a,'NAXA test pharmacie A',0,0,false),
   (v_b,'NAXA test pharmacie B',0,0,false),
   (v_c,'NAXA test pharmacie C',0,0,false)
  on conflict(id) do update set est_demo=false;

  insert into public.abonnements(pharmacie_id,statut,echeance)
  values(v_a,'actif',current_date+30),(v_b,'actif',current_date+30)
  on conflict(pharmacie_id) do update set statut='actif',echeance=current_date+30;

  insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut,architecture_code)
  values(v_promoteur,30000,current_date+30,'active','PARENTS_AINES_CADETS')
  on conflict(promoteur_id) do update set architecture_code='PARENTS_AINES_CADETS',statut='active',date_expiration=current_date+30;

  insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut)
  select v_promoteur,c.id,30000,current_date,current_date+30,'actif'
  from public.conventions_promoteurs c where c.promoteur_id=v_promoteur
  on conflict(promoteur_id) do update
    set convention_id=excluded.convention_id,montant_mensuel=30000,debut=current_date,echeance=current_date+30,statut='actif';

  insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses)
  values
   (v_a,'PARENTS_AINES_CADETS',v_promoteur,true,5,5),
   (v_b,'PARENTS_AINES_CADETS',v_promoteur,true,5,5)
  on conflict(pharmacie_id) do update set architecture_code=excluded.architecture_code,active=true,max_responsables=5,max_caisses=5;

  -- Le lien est créé après la convention + abonnement valides et l'architecture opérationnelle.
  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values(v_promoteur,v_a,true),(v_promoteur,v_b,true)
  on conflict(promoteur_id,pharmacie_id) do update set actif=true;

  perform set_config('request.jwt.claim.sub',v_promoteur::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_promoteur::text,'role','authenticated')::text,true);

  if not public.naxa_scope_allows(v_promoteur,v_a,'PHARMACIE') then raise exception 'Promoteur doit couvrir A'; end if;
  if not public.naxa_scope_allows(v_promoteur,v_b,'PHARMACIE') then raise exception 'Promoteur doit couvrir B'; end if;
  if public.naxa_scope_allows(v_promoteur,v_c,'PHARMACIE') then raise exception 'Promoteur ne doit pas couvrir C'; end if;
  if not public.naxa_has_privilege('VIEW_PHARMACY',v_a,'PHARMACIE') then raise exception 'VIEW_PHARMACY attendu sur A'; end if;
  if public.naxa_has_privilege('VIEW_PHARMACY',v_c,'PHARMACIE') then raise exception 'VIEW_PHARMACY interdit hors réseau'; end if;
  if public.naxa_has_privilege('MANAGE_CONVENTION',v_a,'PHARMACIE') then raise exception 'Promoteur ne doit pas gérer la convention NAXA'; end if;
  if public.naxa_has_privilege('CHANGE_ARCHITECTURE',v_a,'PHARMACIE') then raise exception 'Promoteur ne doit pas changer architecture'; end if;
  if public.naxa_has_privilege('VIEW_GLOBAL_NETWORK',v_a,'PHARMACIE') then raise exception 'VIEW_GLOBAL_NETWORK réservé NAXA'; end if;
  if not public.naxa_has_privilege('VIEW_NETWORK_PILOTAGE',null,'RESEAU') then raise exception 'Promoteur doit disposer du Pilotage réseau'; end if;
  if public.naxa_has_privilege('VIEW_NETWORK_PILOTAGE',v_c,'RESEAU') then raise exception 'Pilotage réseau doit rester borné au réseau Promoteur'; end if;
  if (select count(*) from public.conventions_promoteurs where promoteur_id=v_promoteur)<>1 then raise exception 'Un Promoteur doit avoir une seule convention canonique'; end if;
  update public.promoteur_pharmacies set actif=false where promoteur_id=v_promoteur and pharmacie_id=v_b;
  if public.naxa_scope_allows(v_promoteur,v_b,'PHARMACIE') then raise exception 'Lien désactivé doit fermer le scope'; end if;
  update public.promoteur_pharmacies set actif=true where promoteur_id=v_promoteur and pharmacie_id=v_b;
  if not public.naxa_scope_allows(v_promoteur,v_b,'PHARMACIE') then raise exception 'Réactivation du lien doit restaurer le scope'; end if;

  -- Le Promoteur doit pouvoir créer son Responsable en A3, mais pas en A1/A2.
  update public.pharmacie_architectures set architecture_code='PARENTS_ENFANTS',max_responsables=0,max_caisses=5 where pharmacie_id=v_b;
  update public.profiles set pharmacie_id=v_b,architecture_code='PARENTS_ENFANTS' where id=v_responsable;
  v_rejected:=false;
  begin
    perform public.accrediter_profile(v_responsable,v_b,2::smallint,v_promoteur);
  exception when others then v_rejected:=true;
  end;
  if not v_rejected then raise exception 'A2 doit refuser Responsable'; end if;
  -- Une convention Promoteur couvre tout son réseau : rétablir l’architecture
  -- canonique de B après le scénario négatif, avant de tester l’accréditation A3.
  update public.pharmacie_architectures set architecture_code='PARENTS_AINES_CADETS',max_responsables=5,max_caisses=5 where pharmacie_id=v_b;
  update public.profiles set architecture_code='PARENTS_AINES_CADETS' where id=v_responsable;

  update public.pharmacie_architectures set architecture_code='PARENTS_AINES_CADETS',max_responsables=5,max_caisses=5 where pharmacie_id=v_a;
  update public.profiles set pharmacie_id=v_a,architecture_code='PARENTS_AINES_CADETS' where id=v_responsable;
  perform public.accrediter_profile(v_responsable,v_a,2::smallint,v_promoteur);

  if (select niveau_interne from public.profiles where id=v_responsable)<>2 then raise exception 'Responsable N2 attendu'; end if;
  if (select role::text from public.profiles where id=v_responsable)<>'pharmacie' then raise exception 'Responsable doit conserver role_type pharmacie'; end if;

  -- Le Promoteur peut créer une Caisse directe et lui déléguer un privilège opérationnel.
  update public.profiles set pharmacie_id=v_a,parent_profile_id=v_promoteur,role='caisse',fonction_interne=null,niveau_interne=3,niveau_hierarchique=3,architecture_code='PARENTS_AINES_CADETS',actif=true where id=v_caisse;
  perform public.accrediter_profile(v_caisse,v_a,3::smallint,v_promoteur);
  perform public.naxa_grant_privilege(v_caisse,'VIEW_STOCK',v_a,'POSTE_CAISSE');
  perform set_config('request.jwt.claim.sub',v_caisse::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_caisse::text,'role','authenticated')::text,true);
  if not public.naxa_has_privilege('VIEW_STOCK',v_a,'POSTE_CAISSE') then raise exception 'Caisse VIEW_STOCK attendu'; end if;

  -- Le Promoteur ne peut pas attribuer de privilège de gouvernance.
  v_rejected:=false;
  begin
    perform public.naxa_grant_privilege(v_responsable,'CHANGE_ARCHITECTURE',v_a,'PHARMACIE');
  exception when others then v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Gouvernance doit être refusée'; end if;

  -- Il ne peut pas déléguer à une cible d'une autre pharmacie.
  update public.profiles set pharmacie_id=v_c,parent_profile_id=null,role='pharmacie',fonction_interne='responsable',niveau_interne=2,niveau_hierarchique=2,architecture_code='PARENTS_AINES_CADETS',actif=true where id=v_other;
  v_rejected:=false;
  begin
    perform public.naxa_grant_privilege(v_other,'VIEW_PHARMACY_PILOTAGE',v_c,'PHARMACIE');
  exception when others then v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Cible hors réseau doit être refusée'; end if;

  -- Réseau : uniquement le Promoteur peut recevoir un scope RESEAU ; ici on vérifie la garde structurelle.
  if not exists(select 1 from public.naxa_privileges where code='VIEW_NETWORK_PILOTAGE' and delegable) then
    raise exception 'VIEW_NETWORK_PILOTAGE doit exister au catalogue';
  end if;

  -- RLS : lecture du lien réseau par Promoteur autorisée, anon interdite.
  if has_table_privilege('anon','public.promoteur_pharmacies','SELECT') then
    raise exception 'anon ne doit pas lire promoteur_pharmacies';
  end if;
  if not has_table_privilege('authenticated','public.promoteur_pharmacies','SELECT') then
    raise exception 'authenticated doit pouvoir lire promoteur_pharmacies sous RLS';
  end if;
end
$naxa$;

select '024_promoteur_perimetre PASS' as resultat;

rollback;

-- NAXA 264 — E2E transactionnel crédit Marketplace / Responsable / lots.
-- Base de test uniquement : toutes les créations et écritures sont annulées par ROLLBACK.
begin;

do $e2e$
declare
  v_promoter uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_responsable uuid := gen_random_uuid();
  v_responsable_sans_droit uuid := gen_random_uuid();
  v_client_a uuid := gen_random_uuid();
  v_client_b uuid := gen_random_uuid();
  v_client_c uuid := gen_random_uuid();
  v_client_d uuid := gen_random_uuid();
  v_pharmacie_principale uuid := gen_random_uuid();
  v_pharmacie_affectee uuid := gen_random_uuid();
  v_convention uuid := gen_random_uuid();
  v_assignment_responsable uuid;
  v_assignment_sans_droit uuid;
  v_produit_ab uuid := gen_random_uuid();
  v_produit_restore uuid := gen_random_uuid();
  v_produit_denied uuid := gen_random_uuid();
  v_lot_a uuid := gen_random_uuid();
  v_lot_b uuid := gen_random_uuid();
  v_lot_restore uuid := gen_random_uuid();
  v_lot_denied uuid := gen_random_uuid();
  v_credit_a uuid := gen_random_uuid();
  v_credit_b uuid := gen_random_uuid();
  v_credit_c uuid := gen_random_uuid();
  v_credit_d uuid := gen_random_uuid();
  v_request_a uuid := gen_random_uuid();
  v_request_b uuid := gen_random_uuid();
  v_request_c uuid := gen_random_uuid();
  v_request_d uuid := gen_random_uuid();
  v_reservation_a uuid;
  v_reservation_b uuid;
  v_reservation_c uuid;
  v_reservation_d uuid;
  v_caisse uuid := gen_random_uuid();
  v_session uuid := gen_random_uuid();
  v_sale uuid;
  v_num text;
  v_total integer;
  v_stock integer;
  v_lot_a_qty integer;
  v_lot_b_qty integer;
  v_restored_qty integer;
  v_denied_qty integer;
begin
  -- Auth fixtures.
  set local session_replication_role = 'replica';
  insert into auth.users(
    id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values
    (v_promoter,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa264-promoter-'||replace(v_promoter::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
    (v_admin,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa264-admin-'||replace(v_admin::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
    (v_responsable,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa264-responsable-'||replace(v_responsable::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
    (v_responsable_sans_droit,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa264-responsable-no-right-'||replace(v_responsable_sans_droit::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
    (v_client_a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa264-a-'||replace(v_client_a::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
    (v_client_b,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa264-b-'||replace(v_client_b::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
    (v_client_c,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa264-c-'||replace(v_client_c::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
    (v_client_d,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa264-d-'||replace(v_client_d::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());
  set local session_replication_role = 'origin';

  insert into public.pharmacies(id,nom,ville,lat,lng,actif,visible_recherche)
  values
    (v_pharmacie_principale,'NAXA E2E 264 principale','Yaoundé',3.87,11.52,true,true),
    (v_pharmacie_affectee,'NAXA E2E 264 affectée','Yaoundé',3.88,11.53,true,true);

  insert into public.profiles(
    id,role,first_name,last_name,actif,age_verified,consent_accepted_at,
    niveau_interne,fonction_interne,parent_profile_id,pharmacie_id
  ) values
    (v_promoter,'promoteur','Promoteur','264',true,true,now(),1,'promoteur',null,null),
    (v_admin,'admin','Admin','264',true,true,now(),1,'custom',null,null),
    (v_responsable,'pharmacie','Responsable','264',true,true,now(),2,'responsable',v_promoter,v_pharmacie_principale),
    (v_responsable_sans_droit,'pharmacie','Responsable','264 sans droit',true,true,now(),2,'responsable',v_promoter,v_pharmacie_principale),
    (v_client_a,'client','Client','264 A',true,true,now(),4,null,null,null),
    (v_client_b,'client','Client','264 B',true,true,now(),4,null,null,null),
    (v_client_c,'client','Client','264 C',true,true,now(),4,null,null,null),
    (v_client_d,'client','Client','264 D',true,true,now(),4,null,null,null);

  -- L'architecture et la convention doivent exister avant le rattachement réseau :
  -- le trigger de provisionnement contrôle la validité commerciale au moment du lien.
  insert into public.pharmacie_architectures(
    pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses
  ) values
    (v_pharmacie_principale,'PARENTS_AINES_CADETS',v_promoter,true,5,5),
    (v_pharmacie_affectee,'PARENTS_AINES_CADETS',v_promoter,true,5,5);

  insert into public.conventions_promoteurs(
    id,promoteur_id,montant_mensuel,date_paiement,date_expiration,statut,architecture_code
  ) values (
    v_convention,v_promoter,1000,current_date,current_date+30,'active','PARENTS_AINES_CADETS'
  );

  insert into public.abonnements_promoteurs(
    promoteur_id,convention_id,montant_mensuel,debut,echeance,statut
  ) values (
    v_promoter,v_convention,1000,current_date,current_date+30,'actif'
  );

  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values
    (v_promoter,v_pharmacie_principale,true),
    (v_promoter,v_pharmacie_affectee,true);

  -- Vérifier le provisionnement automatique des droits Promoteur par réseau/architecture.
  if not exists (
    select 1 from public.naxa_profile_privileges
    where profile_id=v_promoter and privilege_code='ASSIGN_USER_TO_PHARMACY'
      and pharmacie_id=v_pharmacie_affectee and scope_type='PHARMACIE'
      and active and revoked_at is null
  ) or not exists (
    select 1 from public.naxa_profile_privileges
    where profile_id=v_promoter and privilege_code='ASSIGN_PRIVILEGE'
      and pharmacie_id=v_pharmacie_affectee and scope_type='PHARMACIE'
      and active and revoked_at is null
  ) or not exists (
    select 1 from public.naxa_profile_privileges
    where profile_id=v_promoter and privilege_code='REVOKE_PRIVILEGE'
      and pharmacie_id=v_pharmacie_affectee and scope_type='PHARMACIE'
      and active and revoked_at is null
  ) then
    raise exception 'Le provisionnement automatique n’a pas accordé les droits Promoteur requis dans la pharmacie affectée';
  end if;

  -- Affectation permanente au moyen de la vraie RPC (expire_at = NULL).
  perform set_config('request.jwt.claim.sub',v_promoter::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_promoter::text,'role','authenticated')::text,true);

  v_assignment_responsable := public.naxa_grant_professional_assignment(
    v_responsable,v_pharmacie_affectee,'responsable',now()-interval '1 minute',null,
    'Couverture multi-pharmacie test E2E 264'
  );

  v_assignment_sans_droit := public.naxa_grant_professional_assignment(
    v_responsable_sans_droit,v_pharmacie_affectee,'responsable',now()-interval '1 minute',null,
    'Contrôle refus sans privilège test E2E 264'
  );

  if not exists (
    select 1 from public.naxa_professional_assignments
    where id=v_assignment_responsable
      and nature_affectation='ordinaire'
      and expire_at is null
      and statut='active'
  ) then raise exception 'L’affectation ordinaire n’est pas permanente'; end if;

  if public.naxa_can('ASSIGN_PRIVILEGE',v_pharmacie_affectee,v_responsable) is not true then
    raise exception 'Le Promoteur ne peut pas gérer le droit d’un Responsable affecté à une autre pharmacie';
  end if;

  perform public.naxa_grant_privilege(
    v_responsable,'APPROVE_MARKETPLACE_CREDIT',v_pharmacie_affectee,'PHARMACIE'
  );

  -- Périmètre multi-pharmacie et délégation explicite.
  perform set_config('request.jwt.claim.sub',v_responsable::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_responsable::text,'role','authenticated')::text,true);

  if public.naxa_scope_allows(v_responsable,v_pharmacie_affectee,'PHARMACIE') is not true then
    raise exception 'Le Responsable affecté n’obtient pas le périmètre de sa seconde pharmacie';
  end if;
  if public.naxa_can_approve_marketplace_credit(v_pharmacie_affectee) is not true then
    raise exception 'Le Responsable avec privilège explicite ne peut pas approuver';
  end if;

  -- Second Responsable affecté, mais sans droit de validation.
  perform set_config('request.jwt.claim.sub',v_responsable_sans_droit::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_responsable_sans_droit::text,'role','authenticated')::text,true);

  if public.naxa_can_approve_marketplace_credit(v_pharmacie_affectee) is not false then
    raise exception 'Un Responsable sans délégation a reçu le droit d’approbation';
  end if;

  -- Stocks, lots, coûts et caisse du scénario.
  insert into public.produits(id,nom) values
    (v_produit_ab,'Produit E2E 264 A/B'),
    (v_produit_restore,'Produit E2E 264 restitution'),
    (v_produit_denied,'Produit E2E 264 refus');

  insert into public.stocks(pharmacie_id,produit_id,prix,quantite,date_peremption)
  values
    (v_pharmacie_affectee,v_produit_ab,1000,10,current_date+90),
    (v_pharmacie_affectee,v_produit_restore,1000,3,current_date+90),
    (v_pharmacie_affectee,v_produit_denied,1000,1,current_date+90);

  insert into public.stocks_couts(pharmacie_id,produit_id,cout_unitaire)
  values
    (v_pharmacie_affectee,v_produit_ab,500),
    (v_pharmacie_affectee,v_produit_restore,500),
    (v_pharmacie_affectee,v_produit_denied,500);

  insert into public.stocks_lots(
    id,pharmacie_id,produit_id,lot,numero_lot,peremption,date_peremption,quantite,bloque
  ) values
    (v_lot_a,v_pharmacie_affectee,v_produit_ab,'LOT-264-A','LOT-264-A',current_date+90,current_date+90,4,false),
    (v_lot_b,v_pharmacie_affectee,v_produit_ab,'LOT-264-B','LOT-264-B',current_date+90,current_date+90,6,false),
    (v_lot_restore,v_pharmacie_affectee,v_produit_restore,'LOT-264-R','LOT-264-R',current_date+90,current_date+90,3,false),
    (v_lot_denied,v_pharmacie_affectee,v_produit_denied,'LOT-264-D','LOT-264-D',current_date+90,current_date+90,1,false);

  insert into public.caisses(id,pharmacie_id,nom,actif)
  values(v_caisse,v_pharmacie_affectee,'Caisse E2E 264',true);

  -- Le testeur Admin crée la session de test ; le retrait sera ensuite exécuté sous ce même acteur.
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_admin::text,'role','authenticated')::text,true);

  insert into public.caisses_sessions(id,caisse_id,ouvert_par,statut,fond_initial)
  values(v_session,v_caisse,v_admin,'ouverte',0);

  insert into public.client_credits(id,client_id,pharmacie_id,plafond,solde,actif,created_by)
  values
    (v_credit_a,v_client_a,v_pharmacie_affectee,10000,0,true,v_admin),
    (v_credit_b,v_client_b,v_pharmacie_affectee,10000,0,true,v_admin),
    (v_credit_c,v_client_c,v_pharmacie_affectee,10000,0,true,v_admin),
    (v_credit_d,v_client_d,v_pharmacie_affectee,10000,0,true,v_admin);

  insert into public.client_credit_requests(
    id,credit_id,pharmacie_id,client_id,montant,statut,requested_by,
    origine,panier_items
  ) values
    (v_request_a,v_credit_a,v_pharmacie_affectee,v_client_a,4000,'en_attente',v_client_a,
      'marketplace',jsonb_build_array(jsonb_build_object('produit_id',v_produit_ab,'quantite',4))),
    (v_request_b,v_credit_b,v_pharmacie_affectee,v_client_b,6000,'en_attente',v_client_b,
      'marketplace',jsonb_build_array(jsonb_build_object('produit_id',v_produit_ab,'quantite',6))),
    (v_request_c,v_credit_c,v_pharmacie_affectee,v_client_c,3000,'en_attente',v_client_c,
      'marketplace',jsonb_build_array(jsonb_build_object('produit_id',v_produit_restore,'quantite',3))),
    (v_request_d,v_credit_d,v_pharmacie_affectee,v_client_d,1000,'en_attente',v_client_d,
      'marketplace',jsonb_build_array(jsonb_build_object('produit_id',v_produit_denied,'quantite',1)));

  -- Refus serveur explicite sans délégation : la demande, le stock et les lots restent intacts.
  perform set_config('request.jwt.claim.sub',v_responsable_sans_droit::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_responsable_sans_droit::text,'role','authenticated')::text,true);

  begin
    perform public.client_credit_demande_decider(v_request_d,true);
    raise exception 'E2E264_EXPECTED_PERMISSION_DENIAL_NOT_RAISED';
  exception when others then
    if sqlerrm = 'E2E264_EXPECTED_PERMISSION_DENIAL_NOT_RAISED' then raise; end if;
    if position('Approbation réservée' in sqlerrm) = 0 then raise; end if;
  end;

  select quantite into v_denied_qty from public.stocks
  where pharmacie_id=v_pharmacie_affectee and produit_id=v_produit_denied;

  if v_denied_qty<>1
     or (select statut from public.client_credit_requests where id=v_request_d)<>'en_attente'
     or exists(select 1 from public.reservations where credit_request_id=v_request_d) then
    raise exception 'Le refus d’un Responsable non autorisé a modifié la demande ou le stock';
  end if;

  -- Approbations B puis A : le stock physique baisse dès la décision.
  perform set_config('request.jwt.claim.sub',v_responsable::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_responsable::text,'role','authenticated')::text,true);

  perform public.client_credit_demande_decider(v_request_b,true);

  select id into v_reservation_b from public.reservations where credit_request_id=v_request_b;
  select quantite into v_stock from public.stocks
  where pharmacie_id=v_pharmacie_affectee and produit_id=v_produit_ab;
  select quantite into v_lot_a_qty from public.stocks_lots where id=v_lot_a;
  select quantite into v_lot_b_qty from public.stocks_lots where id=v_lot_b;

  if v_stock<>4 or v_lot_a_qty<>0 or v_lot_b_qty<>4
     or not exists(select 1 from public.reservations where id=v_reservation_b and stock_decremented=true and stock_restored=false) then
    raise exception 'Après approbation B, le stock agrégé/lots ou le flag de débit est incohérent';
  end if;

  perform public.client_credit_demande_decider(v_request_a,true);

  select id into v_reservation_a from public.reservations where credit_request_id=v_request_a;
  select quantite into v_stock from public.stocks
  where pharmacie_id=v_pharmacie_affectee and produit_id=v_produit_ab;
  select quantite into v_lot_a_qty from public.stocks_lots where id=v_lot_a;
  select quantite into v_lot_b_qty from public.stocks_lots where id=v_lot_b;

  if v_stock<>0 or v_lot_a_qty<>0 or v_lot_b_qty<>0
     or not exists(select 1 from public.reservations where id=v_reservation_a and stock_decremented=true and stock_restored=false) then
    raise exception 'Après approbation A, le stock agrégé/lots n’est pas entièrement débité';
  end if;

  if not exists(
    select 1 from public.reservation_item_lots
    where reservation_id=v_reservation_b and lot_id=v_lot_a and quantite=4 and restauree_at is null
  ) or not exists(
    select 1 from public.reservation_item_lots
    where reservation_id=v_reservation_b and lot_id=v_lot_b and quantite=2 and restauree_at is null
  ) or not exists(
    select 1 from public.reservation_item_lots
    where reservation_id=v_reservation_a and lot_id=v_lot_b and quantite=4 and restauree_at is null
  ) then
    raise exception 'Les allocations FEFO ne suivent pas chaque réservation';
  end if;

  -- Crédit C : annulation/restauration des lots d'origine, une seule fois.
  perform public.client_credit_demande_decider(v_request_c,true);
  select id into v_reservation_c from public.reservations where credit_request_id=v_request_c;

  select quantite into v_stock from public.stocks
  where pharmacie_id=v_pharmacie_affectee and produit_id=v_produit_restore;
  select quantite into v_restored_qty from public.stocks_lots where id=v_lot_restore;
  if v_stock<>0 or v_restored_qty<>0 then
    raise exception 'Le stock C n’a pas été débité à l’approbation';
  end if;

  perform public.restore_stock(v_reservation_c);
  perform public.restore_stock(v_reservation_c);

  select quantite into v_stock from public.stocks
  where pharmacie_id=v_pharmacie_affectee and produit_id=v_produit_restore;
  select quantite into v_restored_qty from public.stocks_lots where id=v_lot_restore;

  if v_stock<>3 or v_restored_qty<>3
     or not exists(select 1 from public.reservations where id=v_reservation_c and stock_restored=true and stock_decremented=false) then
    raise exception 'La restitution du stock annulé n’est pas idempotente';
  end if;

  -- Le retrait POS des deux crédits ne débite plus une seconde fois les lots ni le stock.
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_admin::text,'role','authenticated')::text,true);

  select x.vente_id,x.numero_vente,x.total
  into v_sale,v_num,v_total
  from public.vente_reservation_credit_finaliser(v_reservation_b,v_session,'E2E-264-B') x;

  if v_total<>6000 then raise exception 'Total du retrait B incorrect'; end if;

  select quantite into v_stock from public.stocks
  where pharmacie_id=v_pharmacie_affectee and produit_id=v_produit_ab;
  select quantite into v_lot_a_qty from public.stocks_lots where id=v_lot_a;
  select quantite into v_lot_b_qty from public.stocks_lots where id=v_lot_b;

  if v_stock<>0 or v_lot_a_qty<>0 or v_lot_b_qty<>0 then
    raise exception 'Le retrait B a débité une seconde fois le stock';
  end if;

  if not exists(
    select 1 from public.vente_lignes
    where vente_id=v_sale and lot_id=v_lot_a and quantite=4
  ) or not exists(
    select 1 from public.vente_lignes
    where vente_id=v_sale and lot_id=v_lot_b and quantite=2
  ) then
    raise exception 'Les lignes de vente B ne reprennent pas les lots affectés';
  end if;

  select x.vente_id,x.numero_vente,x.total
  into v_sale,v_num,v_total
  from public.vente_reservation_credit_finaliser(v_reservation_a,v_session,'E2E-264-A') x;

  if v_total<>4000 then raise exception 'Total du retrait A incorrect'; end if;

  select quantite into v_stock from public.stocks
  where pharmacie_id=v_pharmacie_affectee and produit_id=v_produit_ab;
  select quantite into v_lot_a_qty from public.stocks_lots where id=v_lot_a;
  select quantite into v_lot_b_qty from public.stocks_lots where id=v_lot_b;

  if v_stock<>0 or v_lot_a_qty<>0 or v_lot_b_qty<>0 then
    raise exception 'Le retrait A a débité une seconde fois le stock';
  end if;

  if (select count(*) from public.ventes where reservation_id in (v_reservation_a,v_reservation_b))<>2 then
    raise exception 'Deux ventes POS exactement étaient attendues';
  end if;

  -- Le Promoteur délègue le même droit au second Responsable ; le retrait de son
  -- affectation secondaire doit ensuite rendre le droit inactif.
  perform set_config('request.jwt.claim.sub',v_promoter::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_promoter::text,'role','authenticated')::text,true);

  perform public.naxa_grant_privilege(
    v_responsable_sans_droit,'APPROVE_MARKETPLACE_CREDIT',v_pharmacie_affectee,'PHARMACIE'
  );

  -- Vérifier l’action de retrait de privilège explicite avant de le réattribuer.
  perform public.naxa_revoke_privilege(
    v_responsable_sans_droit,'APPROVE_MARKETPLACE_CREDIT',v_pharmacie_affectee,'PHARMACIE'
  );

  perform set_config('request.jwt.claim.sub',v_responsable_sans_droit::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_responsable_sans_droit::text,'role','authenticated')::text,true);

  if public.naxa_can_approve_marketplace_credit(v_pharmacie_affectee) is not false then
    raise exception 'La révocation explicite du privilège n’a pas bloqué l’approbation';
  end if;

  perform set_config('request.jwt.claim.sub',v_promoter::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_promoter::text,'role','authenticated')::text,true);

  perform public.naxa_grant_privilege(
    v_responsable_sans_droit,'APPROVE_MARKETPLACE_CREDIT',v_pharmacie_affectee,'PHARMACIE'
  );

  perform set_config('request.jwt.claim.sub',v_responsable_sans_droit::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_responsable_sans_droit::text,'role','authenticated')::text,true);

  if public.naxa_can_approve_marketplace_credit(v_pharmacie_affectee) is not true then
    raise exception 'Le second Responsable n’a pas obtenu le droit après délégation';
  end if;

  perform public.client_credit_demande_decider(v_request_d,true);
  select id into v_reservation_d from public.reservations where credit_request_id=v_request_d;

  select quantite into v_stock from public.stocks
  where pharmacie_id=v_pharmacie_affectee and produit_id=v_produit_denied;
  if v_stock<>0 then raise exception 'Après délégation, l’approbation D n’a pas débité le stock'; end if;

  perform public.restore_stock(v_reservation_d);

  perform set_config('request.jwt.claim.sub',v_promoter::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_promoter::text,'role','authenticated')::text,true);

  perform public.naxa_revoke_professional_assignment(
    v_assignment_sans_droit,'Fin de la couverture multi-pharmacie E2E 264'
  );

  perform set_config('request.jwt.claim.sub',v_responsable_sans_droit::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_responsable_sans_droit::text,'role','authenticated')::text,true);

  if public.naxa_can_approve_marketplace_credit(v_pharmacie_affectee) is not false then
    raise exception 'La révocation de l’affectation a laissé actif le droit de crédit secondaire';
  end if;

end
$e2e$;

rollback;
select '264_credit_marketplace_debit_on_approval_e2e PASS (transaction rolled back)' as resultat;

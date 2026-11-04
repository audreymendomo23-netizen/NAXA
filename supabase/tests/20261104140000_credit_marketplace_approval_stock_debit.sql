-- NAXA — tests transactionnels du débit à l'approbation, du retrait sans double débit et de la restauration.
-- À exécuter sur une base de test après la migration 20261104140000.
-- Toutes les fixtures et écritures sont annulées par ROLLBACK.

begin;

do $contract$
declare
  v_decider text;
  v_withdraw text;
  v_restore text;
begin
  select pg_get_functiondef('public.client_credit_demande_decider(uuid,boolean)'::regprocedure) into v_decider;
  select pg_get_functiondef('public.vente_reservation_credit_finaliser(uuid,uuid,text)'::regprocedure) into v_withdraw;
  select pg_get_functiondef('public.restore_stock(uuid)'::regprocedure) into v_restore;

  if position('APPROVE_MARKETPLACE_CREDIT' in v_decider)=0
     or position('naxa_has_active_professional_assignment' in v_decider)=0
     or position('naxa_has_privilege' in v_decider)=0 then
    raise exception 'Le contrôle de délégation Responsable est absent de la décision crédit';
  end if;
  if position('stock_decremented=true' in lower(regexp_replace(v_decider,'[[:space:]]+','','g')))=0
     or position('expires_at=null' in lower(regexp_replace(v_decider,'[[:space:]]+','','g')))=0 then
    raise exception 'L’approbation ne marque pas le débit physique ni la réservation sans expiration automatique';
  end if;
  if position('ifnotv_already_decrementedthen' in lower(regexp_replace(v_withdraw,'[[:space:]]+','','g')))=0 then
    raise exception 'Le retrait n’évite pas le second débit du stock';
  end if;
  if position('reservation_item_lots' in lower(v_restore))=0
     or position('stock_restored=true' in lower(regexp_replace(v_restore,'[[:space:]]+','','g')))=0 then
    raise exception 'La restauration idempotente des lots et du stock est absente';
  end if;
  if not exists(select 1 from public.naxa_privileges
    where code='APPROVE_MARKETPLACE_CREDIT' and active and delegable
      and niveau_min=1 and niveau_max=2 and not governance and not governance_only) then
    raise exception 'Le privilège délégable d’approbation Marketplace est absent ou mal configuré';
  end if;
  if not exists(select 1 from public.naxa_architecture_privileges
    where architecture_code='PARENTS_AINES_CADETS' and role_key='responsable'
      and privilege_code='APPROVE_MARKETPLACE_CREDIT')
     or not exists(select 1 from public.naxa_architecture_privileges
    where architecture_code='HYBRIDE' and role_key='responsable'
      and privilege_code='APPROVE_MARKETPLACE_CREDIT') then
    raise exception 'Le privilège Responsable n’est pas borné aux deux architectures compatibles';
  end if;
end;
$contract$;

do $e2e$
declare
  v_admin uuid:=gen_random_uuid();
  v_client_a uuid:=gen_random_uuid();
  v_client_b uuid:=gen_random_uuid();
  v_responsable uuid:=gen_random_uuid();
  v_ph uuid:=gen_random_uuid();
  v_ph_home uuid:=gen_random_uuid();
  v_prod uuid:=gen_random_uuid();
  v_caisse uuid:=gen_random_uuid();
  v_session uuid:=gen_random_uuid();
  v_credit_a uuid:=gen_random_uuid();
  v_credit_b uuid:=gen_random_uuid();
  v_req_a uuid:=gen_random_uuid();
  v_req_b uuid:=gen_random_uuid();
  v_res_a uuid;
  v_res_b uuid;
  v_sale uuid;
  v_num text;
  v_total integer;
  v_stock integer;
  v_lot_a uuid:=gen_random_uuid();
  v_lot_b uuid:=gen_random_uuid();
  v_qty_a integer;
  v_qty_b integer;
  v_initial_allocation integer;
begin
  set local session_replication_role='replica';
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
    (v_admin,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa-credit-debit-admin-'||replace(v_admin::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
    (v_client_a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa-credit-debit-a-'||replace(v_client_a::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
    (v_client_b,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa-credit-debit-b-'||replace(v_client_b::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());
  set local session_replication_role='origin';

  insert into public.profiles(id,role,first_name,last_name,actif,age_verified,consent_accepted_at,niveau_interne,fonction_interne,pharmacie_id,parent_profile_id)
  values
    (v_admin,'admin','NAXA','Admin test',true,true,now(),1,null,null,null),
    (v_client_a,'client','NAXA','Client A',true,true,now(),4,null,null,null),
    (v_client_b,'client','NAXA','Client B',true,true,now(),4,null,null,null),
    (v_responsable,'pharmacie','NAXA','Responsable test',true,true,now(),2,'responsable',v_ph_home,null);

  insert into public.pharmacies(id,nom,ville,lat,lng,actif,visible_recherche)
  values
    (v_ph,'NAXA test crédit débit','Yaoundé',3.87,11.52,true,true),
    (v_ph_home,'NAXA test pharmacie principale','Yaoundé',3.88,11.53,true,true);
  insert into public.produits(id,nom) values(v_prod,'Produit test crédit débit');
  insert into public.stocks(pharmacie_id,produit_id,prix,quantite,date_peremption)
  values(v_ph,v_prod,1000,10,current_date+90);
  insert into public.stocks_couts(pharmacie_id,produit_id,cout_unitaire)
  values(v_ph,v_prod,500);
  insert into public.stocks_lots(id,pharmacie_id,produit_id,lot,numero_lot,peremption,date_peremption,quantite,bloque)
  values
    (v_lot_a,v_ph,v_prod,'LOT-A','LOT-A',current_date+90,current_date+90,4,false),
    (v_lot_b,v_ph,v_prod,'LOT-B','LOT-B',current_date+90,current_date+90,6,false);
  insert into public.caisses(id,pharmacie_id,nom,actif)
  values(v_caisse,v_ph,'Caisse test crédit débit',true);
  insert into public.caisses_sessions(id,caisse_id,ouvert_par,statut,fond_initial)
  values(v_session,v_caisse,v_admin,'ouverte',0);
  insert into public.client_credits(id,client_id,pharmacie_id,plafond,solde,actif,created_by)
  values
    (v_credit_a,v_client_a,v_ph,10000,0,true,v_admin),
    (v_credit_b,v_client_b,v_ph,10000,0,true,v_admin);

  -- Une affectation ordinaire sans échéance doit ouvrir uniquement la pharmacie ciblée.
  insert into public.naxa_professional_assignments(
    profile_id,pharmacie_id,fonction,statut,nature_affectation,motif,commence_at,expire_at,accorde_par
  ) values(v_responsable,v_ph,'responsable','active','ordinaire','Couverture permanente pharmacie secondaire',now()-interval '1 hour',null,v_admin);
  if not public.naxa_has_active_professional_assignment(v_responsable,v_ph,'responsable')
     or not private.naxa_scope_allows(v_responsable,v_ph,'PHARMACIE')
     or private.naxa_scope_allows(v_responsable,v_ph_home,'PHARMACIE') then
    raise exception 'L’affectation permanente ne couvre pas exactement le périmètre pharmacie autorisé';
  end if;

  insert into public.client_credit_requests(
    id,credit_id,pharmacie_id,client_id,montant,statut,requested_by,origine,panier_items
  ) values
    (v_req_a,v_credit_a,v_ph,v_client_a,5000,'en_attente',v_client_a,'marketplace',
      jsonb_build_array(jsonb_build_object('produit_id',v_prod,'quantite',5))),
    (v_req_b,v_credit_b,v_ph,v_client_b,5000,'en_attente',v_client_b,'marketplace',
      jsonb_build_array(jsonb_build_object('produit_id',v_prod,'quantite',5)));

  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_admin::text,'role','authenticated')::text,true);

  -- Approbation A : débit immédiat stock (5), FEFO (4+1), état durable sans expiration.
  perform public.client_credit_demande_decider(v_req_a,true);
  select reservation_id into v_res_a from public.client_credit_requests where id=v_req_a;
  select quantite into v_stock from public.stocks where pharmacie_id=v_ph and produit_id=v_prod;
  select quantite into v_qty_a from public.stocks_lots where id=v_lot_a;
  select quantite into v_qty_b from public.stocks_lots where id=v_lot_b;
  select coalesce(sum(quantite),0)::integer into v_initial_allocation
    from public.reservation_item_lots where reservation_id=v_res_a and restauree_at is null;
  if v_stock<>5 or v_qty_a<>0 or v_qty_b<>5 or v_initial_allocation<>5 then
    raise exception 'Approbation A : débit physique/FEFO incohérent (stock %, lot A %, lot B %, allocation %)',
      v_stock,v_qty_a,v_qty_b,v_initial_allocation;
  end if;
  if not exists(select 1 from public.reservations where id=v_res_a
    and stock_decremented and not stock_restored and expires_at is null
    and credit_request_id=v_req_a and preparation_statut='non_commencee') then
    raise exception 'Approbation A : état de réservation durable ou lien crédit manquant';
  end if;

  -- Retrait A : doit créer vente + opération de crédit sans modifier à nouveau le stock.
  select x.vente_id,x.numero_vente,x.total into v_sale,v_num,v_total
  from public.vente_reservation_credit_finaliser(v_res_a,v_session,'TEST-CREDIT-DEBIT-A') x;
  select quantite into v_stock from public.stocks where pharmacie_id=v_ph and produit_id=v_prod;
  select quantite into v_qty_a from public.stocks_lots where id=v_lot_a;
  select quantite into v_qty_b from public.stocks_lots where id=v_lot_b;
  if v_total<>5000 or v_stock<>5 or v_qty_a<>0 or v_qty_b<>5 then
    raise exception 'Retrait A : second débit détecté (total %, stock %, lot A %, lot B %)',
      v_total,v_stock,v_qty_a,v_qty_b;
  end if;
  if not exists(select 1 from public.vente_lignes where vente_id=v_sale and lot_id=v_lot_a and quantite=4)
     or not exists(select 1 from public.vente_lignes where vente_id=v_sale and lot_id=v_lot_b and quantite=1) then
    raise exception 'Retrait A : la vente ne conserve pas les lots réellement affectés';
  end if;
  if not exists(select 1 from public.reservations where id=v_res_a and consumed_at is not null)
     or not exists(select 1 from public.client_credit_requests where id=v_req_a and consumed_at is not null) then
    raise exception 'Retrait A : la réservation ou la demande n’a pas été consommée';
  end if;

  -- Approbation B puis annulation avant retrait : les mêmes lots doivent être restitués une seule fois.
  perform public.client_credit_demande_decider(v_req_b,true);
  select reservation_id into v_res_b from public.client_credit_requests where id=v_req_b;
  select quantite into v_stock from public.stocks where pharmacie_id=v_ph and produit_id=v_prod;
  select quantite into v_qty_a from public.stocks_lots where id=v_lot_a;
  select quantite into v_qty_b from public.stocks_lots where id=v_lot_b;
  if v_stock<>0 or v_qty_a<>0 or v_qty_b<>0 then
    raise exception 'Approbation B : le second débit du stock disponible est incorrect';
  end if;

  perform private.set_reservation_status(v_res_b,'annulee'::public.resa_statut);
  perform public.restore_stock(v_res_b);
  select quantite into v_stock from public.stocks where pharmacie_id=v_ph and produit_id=v_prod;
  select quantite into v_qty_a from public.stocks_lots where id=v_lot_a;
  select quantite into v_qty_b from public.stocks_lots where id=v_lot_b;
  if v_stock<>5 or v_qty_a<>0 or v_qty_b<>5 then
    raise exception 'Annulation B : restitution incorrecte (stock %, lot A %, lot B %)',v_stock,v_qty_a,v_qty_b;
  end if;
  if not exists(select 1 from public.reservations where id=v_res_b
    and stock_restored and not stock_decremented and statut='annulee') then
    raise exception 'Annulation B : garde idempotence non enregistrée';
  end if;
end
$e2e$;

rollback;
select '20261104140000_credit_marketplace_approval_stock_debit PASS' as resultat;

-- E2E transactionnel : crédit direct Caisse, dépassement, approbation, stock et outbox comptable.
begin;
do $e2e$
declare
  v_admin uuid:=gen_random_uuid();
  v_client uuid:=gen_random_uuid();
  v_ph uuid:=gen_random_uuid();
  v_product uuid:=gen_random_uuid();
  v_caisse uuid:=gen_random_uuid();
  v_session uuid:=gen_random_uuid();
  v_sale uuid;
  v_status text;
  v_request uuid;
  v_operation uuid;
  v_number text;
  v_total integer;
  v_stock integer;
  v_balance integer;
begin
  set local session_replication_role='replica';
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
    (v_admin,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa-credit-pos-admin-'||replace(v_admin::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
    (v_client,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa-credit-pos-client-'||replace(v_client::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());
  set local session_replication_role='origin';

  insert into public.profiles(id,role,first_name,last_name,actif,age_verified,consent_accepted_at,niveau_interne)
  values
    (v_admin,'admin','NAXA','Credit POS E2E',true,true,now(),1),
    (v_client,'client','Client','Credit POS E2E',true,true,now(),4);

  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_admin::text,'role','authenticated')::text,true);

  insert into public.pharmacies(id,nom,ville,lat,lng,actif,visible_recherche)
  values(v_ph,'NAXA credit POS E2E','Yaoundé',3.87,11.52,true,false);
  set local session_replication_role='replica';
  insert into public.produits(id,nom) values(v_product,'Produit crédit comptoir E2E');
  set local session_replication_role='origin';
  insert into public.stocks(pharmacie_id,produit_id,prix,quantite,date_peremption)
  values(v_ph,v_product,1000,5,private.naxa_date_cameroun()+90);
  insert into public.stocks_couts(pharmacie_id,produit_id,cout_unitaire)
  values(v_ph,v_product,500);
  insert into public.caisses(id,pharmacie_id,nom,actif) values(v_caisse,v_ph,'Caisse credit POS E2E',true);
  insert into public.caisses_sessions(id,caisse_id,ouvert_par,statut,fond_initial)
  values(v_session,v_caisse,v_admin,'ouverte',0);
  insert into public.client_credits(client_id,pharmacie_id,plafond,solde,actif,created_by)
  values(v_client,v_ph,500,0,true,v_admin);

  -- 1) Dépassement : la demande attend une décision sans mouvement physique de stock.
  v_sale:=public.vente_creer(v_session,v_client);
  perform public.vente_ajouter_produit(v_sale,v_product,1);
  select x.resultat,x.demande_id,x.operation_id,x.numero_vente,x.total
    into v_status,v_request,v_operation,v_number,v_total
  from public.vente_credit_finaliser(v_sale,'E2E-CREDIT-POS-OVER') x;
  if v_status<>'decision_requise' or v_request is null or v_total<>1000 then
    raise exception 'Le dépassement du plafond ne crée pas de demande Caisse cohérente';
  end if;
  if (select quantite from public.stocks where pharmacie_id=v_ph and produit_id=v_product)<>5
     or exists(select 1 from public.vente_paiements where vente_id=v_sale)
     or (select solde from public.client_credits where client_id=v_client and pharmacie_id=v_ph)<>0 then
    raise exception 'La demande en attente a modifié le stock, le paiement ou le solde';
  end if;
  if (select origine from public.client_credit_requests where id=v_request)<>'caisse'
     or (select vente_id from public.client_credit_requests where id=v_request) is distinct from v_sale then
    raise exception 'La demande comptoir n’est pas liée à sa vente POS';
  end if;

  -- 2) Décision Promoteur/Admin ; la même vente est ensuite finalisée sans nouveau panier.
  perform public.client_credit_demande_decider(v_request,true);
  select x.resultat,x.demande_id,x.operation_id,x.numero_vente,x.total
    into v_status,v_request,v_operation,v_number,v_total
  from public.vente_credit_finaliser(v_sale,'E2E-CREDIT-POS-APPROVED') x;
  if v_status<>'finalisee' or v_operation is null or v_total<>1000 then
    raise exception 'La vente n’a pas repris après approbation du crédit';
  end if;
  select quantite into v_stock from public.stocks where pharmacie_id=v_ph and produit_id=v_product;
  select solde into v_balance from public.client_credits where client_id=v_client and pharmacie_id=v_ph;
  if v_stock<>4 or v_balance<>1000 then
    raise exception 'Le stock ou le solde client ne reflète pas une vente crédit unique';
  end if;
  if not exists(select 1 from public.ventes where id=v_sale and statut='payee' and mode_paiement='credit')
     or not exists(select 1 from public.vente_paiements where vente_id=v_sale and mode='credit' and montant_percu=1000 and monnaie_rendue=0)
     or not exists(select 1 from public.client_credit_operations where id=v_operation and nature='credit' and caisse_session_id=v_session)
  then raise exception 'La vente, le paiement ou le registre de crédit POS ne sont pas reliés'; end if;
  if not exists(select 1 from public.compta_evenement where source_type='credit_operation' and source_id=v_operation::text and evenement_type='credit_octroi')
     or exists(select 1 from public.compta_evenement where source_type='vente' and source_id=v_sale::text and evenement_type='vente_encaissee')
  then raise exception 'L’octroi de crédit n’est pas isolé de l’encaissement comptable'; end if;

  -- 3) Sous plafond : finalisation directe, même moteur, aucun événement d'encaissement.
  update public.client_credits set plafond=3000 where client_id=v_client and pharmacie_id=v_ph;
  v_sale:=public.vente_creer(v_session,v_client);
  perform public.vente_ajouter_produit(v_sale,v_product,1);
  select x.resultat,x.demande_id,x.operation_id,x.numero_vente,x.total
    into v_status,v_request,v_operation,v_number,v_total
  from public.vente_credit_finaliser(v_sale,'E2E-CREDIT-POS-WITHIN-LIMIT') x;
  if v_status<>'finalisee' or v_operation is null then
    raise exception 'Le crédit sous plafond n’a pas été finalisé directement';
  end if;
  select quantite into v_stock from public.stocks where pharmacie_id=v_ph and produit_id=v_product;
  select solde into v_balance from public.client_credits where client_id=v_client and pharmacie_id=v_ph;
  if v_stock<>3 or v_balance<>2000 then
    raise exception 'Le second crédit sous plafond a causé un débit ou un solde incorrect';
  end if;
  if (select count(*) from public.compta_evenement where source_type='credit_operation' and evenement_type='credit_octroi')<>2
     or exists(select 1 from public.compta_evenement where source_type='vente' and source_id=v_sale::text and evenement_type='vente_encaissee')
  then raise exception 'Les événements comptables des octrois ne sont pas idempotents ou isolés'; end if;
end
$e2e$;
rollback;
select '20261115220000_credit_marketplace_pos_end_to_end PASS (transaction rolled back)' as resultat;

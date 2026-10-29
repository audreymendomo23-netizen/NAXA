-- NAXA 259 — E2E transactionnel : deux retraits crédit dans l'ordre inverse des allocations.
-- Base de test uniquement. Les fixtures métier et les écritures sont toutes annulées.
begin;
do $e2e$
declare
  v_admin uuid:=gen_random_uuid(); v_client_a uuid:=gen_random_uuid(); v_client_b uuid:=gen_random_uuid();
  v_ph uuid:=gen_random_uuid(); v_prod uuid:=gen_random_uuid(); v_caisse uuid:=gen_random_uuid(); v_session uuid:=gen_random_uuid();
  v_credit_a uuid:=gen_random_uuid(); v_credit_b uuid:=gen_random_uuid(); v_res_a uuid:=gen_random_uuid(); v_res_b uuid:=gen_random_uuid();
  v_req_a uuid:=gen_random_uuid(); v_req_b uuid:=gen_random_uuid(); v_lot_a uuid:=gen_random_uuid(); v_lot_b uuid:=gen_random_uuid();
  v_sale uuid; v_num text; v_total integer; v_qty_a integer; v_qty_b integer; v_stock integer;
begin
  set local session_replication_role='replica';
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values
   (v_admin,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa259-admin-'||replace(v_admin::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
   (v_client_a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa259-a-'||replace(v_client_a::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
   (v_client_b,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','naxa259-b-'||replace(v_client_b::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());
  set local session_replication_role='origin';
  insert into public.profiles(id,role,first_name,last_name,actif,age_verified,consent_accepted_at,niveau_interne)
  values (v_admin,'admin','NAXA','Admin test',true,true,now(),1),(v_client_a,'client','NAXA','Client A',true,true,now(),4),(v_client_b,'client','NAXA','Client B',true,true,now(),4);
  insert into public.pharmacies(id,nom,ville,lat,lng,actif,visible_recherche) values(v_ph,'NAXA test retrait 259','Yaoundé',3.87,11.52,true,true);
  insert into public.produits(id,nom) values(v_prod,'NAXA produit retrait 259');
  insert into public.stocks(pharmacie_id,produit_id,prix,quantite,date_peremption) values(v_ph,v_prod,1000,10,current_date+90);
  insert into public.stocks_couts(pharmacie_id,produit_id,cout_unitaire) values(v_ph,v_prod,500);
  insert into public.stocks_lots(id,pharmacie_id,produit_id,lot,numero_lot,peremption,date_peremption,quantite,bloque)
  values (v_lot_a,v_ph,v_prod,'LOT-A','LOT-A',current_date+90,current_date+90,4,false),(v_lot_b,v_ph,v_prod,'LOT-B','LOT-B',current_date+90,current_date+90,6,false);
  insert into public.caisses(id,pharmacie_id,nom,actif) values(v_caisse,v_ph,'NAXA test caisse',true);
  insert into public.caisses_sessions(id,caisse_id,ouvert_par,statut,fond_initial) values(v_session,v_caisse,v_admin,'ouverte',0);
  insert into public.client_credits(id,client_id,pharmacie_id,plafond,solde,actif,created_by)
  values (v_credit_a,v_client_a,v_ph,10000,0,true,v_admin),(v_credit_b,v_client_b,v_ph,10000,0,true,v_admin);
  insert into public.reservations(id,client_id,pharmacie_id,expires_at,mode,statut,total,paiement_statut,stock_decremented,stock_restored,consumed_at)
  values (v_res_a,v_client_a,v_ph,now()+interval '2 hours','reservation','confirmee',4000,'a_verifier',false,false,null),(v_res_b,v_client_b,v_ph,now()+interval '2 hours','reservation','confirmee',6000,'a_verifier',false,false,null);
  insert into public.reservation_items(reservation_id,produit_id,quantite,prix_unitaire) values(v_res_a,v_prod,4,1000),(v_res_b,v_prod,6,1000);
  insert into public.client_credit_requests(id,credit_id,pharmacie_id,client_id,montant,statut,requested_by,decided_by,decided_at,origine,panier_items,reservation_id)
  values (v_req_a,v_credit_a,v_ph,v_client_a,4000,'approuvee',v_client_a,v_admin,now(),'marketplace',jsonb_build_array(jsonb_build_object('produit_id',v_prod,'quantite',4)),v_res_a),(v_req_b,v_credit_b,v_ph,v_client_b,6000,'approuvee',v_client_b,v_admin,now(),'marketplace',jsonb_build_array(jsonb_build_object('produit_id',v_prod,'quantite',6)),v_res_b);
  update public.reservations set credit_request_id=v_req_a where id=v_res_a;
  update public.reservations set credit_request_id=v_req_b where id=v_res_b;
  insert into public.reservation_item_lots(reservation_id,produit_id,lot_id,quantite) values(v_res_a,v_prod,v_lot_a,4),(v_res_b,v_prod,v_lot_b,6);
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_admin::text,'role','authenticated')::text,true);

  select x.vente_id,x.numero_vente,x.total into v_sale,v_num,v_total from public.vente_reservation_credit_finaliser(v_res_b,v_session,'E2E-259-B') x;
  if v_total<>6000 then raise exception 'B withdrawal total incorrect'; end if;
  select quantite into v_qty_a from public.stocks_lots where id=v_lot_a;
  select quantite into v_qty_b from public.stocks_lots where id=v_lot_b;
  select quantite into v_stock from public.stocks where pharmacie_id=v_ph and produit_id=v_prod;
  if v_qty_a<>4 or v_qty_b<>0 or v_stock<>4 then raise exception 'Inverse withdrawal B consumed wrong lot/stock: A %, B %, aggregate %',v_qty_a,v_qty_b,v_stock; end if;
  if not exists(select 1 from public.vente_lignes where vente_id=v_sale and lot_id=v_lot_b and quantite=6) then raise exception 'Sale B does not reference allocated lot B'; end if;

  select x.vente_id,x.numero_vente,x.total into v_sale,v_num,v_total from public.vente_reservation_credit_finaliser(v_res_a,v_session,'E2E-259-A') x;
  if v_total<>4000 then raise exception 'A withdrawal total incorrect'; end if;
  select quantite into v_qty_a from public.stocks_lots where id=v_lot_a;
  select quantite into v_qty_b from public.stocks_lots where id=v_lot_b;
  select quantite into v_stock from public.stocks where pharmacie_id=v_ph and produit_id=v_prod;
  if v_qty_a<>0 or v_qty_b<>0 or v_stock<>0 then raise exception 'Final stock mismatch: A %, B %, aggregate %',v_qty_a,v_qty_b,v_stock; end if;
  if (select solde from public.client_credits where id=v_credit_a)<>4000 or (select solde from public.client_credits where id=v_credit_b)<>6000 then raise exception 'Client credit balances do not match the two withdrawals'; end if;
  if (select count(*) from public.ventes where reservation_id in (v_res_a,v_res_b))<>2 then raise exception 'Expected exactly two sales'; end if;
  if (select count(*) from public.client_credit_operations where vente_id in (select id from public.ventes where reservation_id in (v_res_a,v_res_b)) and nature='credit')<>2 then raise exception 'Expected exactly two credit operations'; end if;
end
$e2e$;
rollback;
select '259_credit_withdrawal_inverse_order_e2e PASS (transaction rolled back)' as resultat;

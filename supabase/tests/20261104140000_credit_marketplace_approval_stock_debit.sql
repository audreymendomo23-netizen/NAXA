-- NAXA — tests transactionnels du débit Marketplace à l'approbation et du retrait/restauration sans double mouvement.
-- À exécuter sur une base de test après la migration 20261104140000. Fixtures annulées par ROLLBACK.
begin;

create temporary table _naxa_credit_debit_ids on commit drop as
select gen_random_uuid() admin_id,gen_random_uuid() client_a_id,gen_random_uuid() client_b_id,
 gen_random_uuid() responsable_id,gen_random_uuid() pharmacie_id,gen_random_uuid() pharmacie_principale_id,
 gen_random_uuid() produit_id,gen_random_uuid() caisse_id,gen_random_uuid() session_id,
 gen_random_uuid() credit_a_id,gen_random_uuid() credit_b_id,gen_random_uuid() demande_a_id,
 gen_random_uuid() demande_b_id,gen_random_uuid() lot_a_id,gen_random_uuid() lot_b_id;

set local session_replication_role='replica';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select admin_id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated','naxa-credit-admin-'||replace(admin_id::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now() from _naxa_credit_debit_ids
union all
select client_a_id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated','naxa-credit-a-'||replace(client_a_id::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now() from _naxa_credit_debit_ids
union all
select client_b_id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated','naxa-credit-b-'||replace(client_b_id::text,'-','')||'@example.invalid','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now() from _naxa_credit_debit_ids;
set local session_replication_role='origin';

insert into public.profiles(id,role,first_name,last_name,actif,age_verified,consent_accepted_at,niveau_interne,fonction_interne,pharmacie_id,parent_profile_id)
select admin_id,'admin'::public.role_type,'NAXA','Admin test',true,true,now(),1,null::text,null::uuid,null::uuid from _naxa_credit_debit_ids;
insert into public.profiles(id,role,first_name,last_name,actif,age_verified,consent_accepted_at,niveau_interne,fonction_interne,pharmacie_id,parent_profile_id)
select client_a_id,'client'::public.role_type,'NAXA','Client A',true,true,now(),4,null::text,null::uuid,null::uuid from _naxa_credit_debit_ids;
insert into public.profiles(id,role,first_name,last_name,actif,age_verified,consent_accepted_at,niveau_interne,fonction_interne,pharmacie_id,parent_profile_id)
select client_b_id,'client'::public.role_type,'NAXA','Client B',true,true,now(),4,null::text,null::uuid,null::uuid from _naxa_credit_debit_ids;
insert into public.profiles(id,role,first_name,last_name,actif,age_verified,consent_accepted_at,niveau_interne,fonction_interne,pharmacie_id,parent_profile_id)
select responsable_id,'pharmacie'::public.role_type,'NAXA','Responsable test',true,true,now(),2,'responsable',pharmacie_principale_id,null::uuid from _naxa_credit_debit_ids;
insert into public.pharmacies(id,nom,ville,lat,lng,actif,visible_recherche)
select pharmacie_id,'NAXA test crédit débit','Yaoundé',3.87,11.52,true,true from _naxa_credit_debit_ids
union all select pharmacie_principale_id,'NAXA test pharmacie principale','Yaoundé',3.88,11.53,true,true from _naxa_credit_debit_ids;
insert into public.produits(id,nom) select produit_id,'Produit test crédit débit' from _naxa_credit_debit_ids;
insert into public.stocks(pharmacie_id,produit_id,prix,quantite,date_peremption)
select pharmacie_id,produit_id,1000,10,current_date+90 from _naxa_credit_debit_ids;
insert into public.stocks_couts(pharmacie_id,produit_id,cout_unitaire)
select pharmacie_id,produit_id,500 from _naxa_credit_debit_ids;
insert into public.stocks_lots(id,pharmacie_id,produit_id,lot,numero_lot,peremption,date_peremption,quantite,bloque)
select lot_a_id,pharmacie_id,produit_id,'LOT-A','LOT-A',current_date+90,current_date+90,4,false from _naxa_credit_debit_ids
union all select lot_b_id,pharmacie_id,produit_id,'LOT-B','LOT-B',current_date+90,current_date+90,6,false from _naxa_credit_debit_ids;
insert into public.caisses(id,pharmacie_id,nom,actif)
select caisse_id,pharmacie_id,'Caisse test crédit débit',true from _naxa_credit_debit_ids;
insert into public.caisses_sessions(id,caisse_id,ouvert_par,statut,fond_initial)
select session_id,caisse_id,admin_id,'ouverte',0 from _naxa_credit_debit_ids;
insert into public.client_credits(id,client_id,pharmacie_id,plafond,solde,actif,created_by)
select credit_a_id,client_a_id,pharmacie_id,10000,0,true,admin_id from _naxa_credit_debit_ids
union all select credit_b_id,client_b_id,pharmacie_id,10000,0,true,admin_id from _naxa_credit_debit_ids;

-- L’affectation permanente couvre une pharmacie secondaire, et aucune autre.
insert into public.naxa_professional_assignments(profile_id,pharmacie_id,fonction,statut,nature_affectation,motif,commence_at,expire_at,accorde_par)
select responsable_id,pharmacie_id,'responsable','active','ordinaire','Couverture permanente pharmacie secondaire',now()-interval '1 hour',null,admin_id
from _naxa_credit_debit_ids;

insert into public.client_credit_requests(id,credit_id,pharmacie_id,client_id,montant,statut,requested_by,origine,panier_items)
select demande_a_id,credit_a_id,pharmacie_id,client_a_id,5000,'en_attente',client_a_id,'marketplace',
 jsonb_build_array(jsonb_build_object('produit_id',produit_id,'quantite',5)) from _naxa_credit_debit_ids
union all
select demande_b_id,credit_b_id,pharmacie_id,client_b_id,5000,'en_attente',client_b_id,'marketplace',
 jsonb_build_array(jsonb_build_object('produit_id',produit_id,'quantite',5)) from _naxa_credit_debit_ids;

do $contract$
declare v_decider text;v_withdraw text;v_restore text;
begin
 select pg_get_functiondef('public.client_credit_demande_decider(uuid,boolean)'::regprocedure) into v_decider;
 select pg_get_functiondef('public.vente_reservation_credit_finaliser(uuid,uuid,text)'::regprocedure) into v_withdraw;
 select pg_get_functiondef('public.restore_stock(uuid)'::regprocedure) into v_restore;
 if position('APPROVE_MARKETPLACE_CREDIT' in v_decider)=0
   or position('naxa_has_active_professional_assignment' in v_decider)=0
   or position('naxa_has_privilege' in v_decider)=0 then raise exception 'Contrôle de délégation Responsable absent'; end if;
 if position('stock_decremented=true' in lower(regexp_replace(v_decider,'[[:space:]]+','','g')))=0
   or position('expires_at=null' in lower(regexp_replace(v_decider,'[[:space:]]+','','g')))=0 then raise exception 'Débit/expiration durable absents'; end if;
 if position('ifnotv_already_decrementedthen' in lower(regexp_replace(v_withdraw,'[[:space:]]+','','g')))=0 then raise exception 'Le retrait peut débiter deux fois'; end if;
 if position('reservation_item_lots' in lower(v_restore))=0
   or position('stock_restored=true' in lower(regexp_replace(v_restore,'[[:space:]]+','','g')))=0 then raise exception 'Restauration idempotente des lots absente'; end if;
 if not exists(select 1 from public.naxa_privileges where code='APPROVE_MARKETPLACE_CREDIT' and active and delegable and niveau_min=1 and niveau_max=2 and not governance and not governance_only) then raise exception 'Privilège délégable mal configuré'; end if;
 if not exists(select 1 from public.naxa_architecture_privileges where architecture_code='PARENTS_AINES_CADETS' and role_key='responsable' and privilege_code='APPROVE_MARKETPLACE_CREDIT')
   or not exists(select 1 from public.naxa_architecture_privileges where architecture_code='HYBRIDE' and role_key='responsable' and privilege_code='APPROVE_MARKETPLACE_CREDIT') then raise exception 'Privilège hors architectures compatibles'; end if;
end;
$contract$;

do $e2e$
declare x record;v_res_a uuid;v_res_b uuid;v_sale uuid;v_num text;v_total integer;v_stock integer;v_qty_a integer;v_qty_b integer;v_allocated integer;
begin
 select * into x from _naxa_credit_debit_ids;
 perform set_config('request.jwt.claim.sub',x.admin_id::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',x.admin_id::text,'role','authenticated')::text,true);

 if not public.naxa_has_active_professional_assignment(x.responsable_id,x.pharmacie_id,'responsable')
   or not private.naxa_scope_allows(x.responsable_id,x.pharmacie_id,'PHARMACIE')
   or private.naxa_scope_allows(x.responsable_id,x.pharmacie_principale_id,'PHARMACIE') then
   raise exception 'Affectation permanente : périmètre pharmacie incorrect'; end if;

 perform public.client_credit_demande_decider(x.demande_a_id,true);
 select reservation_id into v_res_a from public.client_credit_requests where id=x.demande_a_id;
 select quantite into v_stock from public.stocks where pharmacie_id=x.pharmacie_id and produit_id=x.produit_id;
 select quantite into v_qty_a from public.stocks_lots where id=x.lot_a_id;
 select quantite into v_qty_b from public.stocks_lots where id=x.lot_b_id;
 select coalesce(sum(quantite),0)::integer into v_allocated from public.reservation_item_lots where reservation_id=v_res_a and restauree_at is null;
 if v_stock<>5 or v_qty_a<>0 or v_qty_b<>5 or v_allocated<>5 then raise exception 'Approbation A : débit FEFO incohérent'; end if;
 if not exists(select 1 from public.reservations where id=v_res_a and stock_decremented and not stock_restored and expires_at is null and credit_request_id=x.demande_a_id and preparation_statut='non_commencee') then
   raise exception 'Approbation A : réservation durable ou lien crédit manquant'; end if;

 select r.vente_id,r.numero_vente,r.total into v_sale,v_num,v_total
 from public.vente_reservation_credit_finaliser(v_res_a,x.session_id,'TEST-CREDIT-DEBIT-A') r;
 select quantite into v_stock from public.stocks where pharmacie_id=x.pharmacie_id and produit_id=x.produit_id;
 select quantite into v_qty_a from public.stocks_lots where id=x.lot_a_id;
 select quantite into v_qty_b from public.stocks_lots where id=x.lot_b_id;
 if v_total<>5000 or v_stock<>5 or v_qty_a<>0 or v_qty_b<>5 then raise exception 'Retrait A : double débit détecté'; end if;
 if not exists(select 1 from public.vente_lignes where vente_id=v_sale and lot_id=x.lot_a_id and quantite=4)
   or not exists(select 1 from public.vente_lignes where vente_id=v_sale and lot_id=x.lot_b_id and quantite=1) then raise exception 'Retrait A : lots d’origine non conservés'; end if;
 if not exists(select 1 from public.reservations where id=v_res_a and consumed_at is not null)
   or not exists(select 1 from public.client_credit_requests where id=x.demande_a_id and consumed_at is not null) then raise exception 'Retrait A : consommation non enregistrée'; end if;

 perform public.client_credit_demande_decider(x.demande_b_id,true);
 select reservation_id into v_res_b from public.client_credit_requests where id=x.demande_b_id;
 select quantite into v_stock from public.stocks where pharmacie_id=x.pharmacie_id and produit_id=x.produit_id;
 select quantite into v_qty_a from public.stocks_lots where id=x.lot_a_id;
 select quantite into v_qty_b from public.stocks_lots where id=x.lot_b_id;
 if v_stock<>0 or v_qty_a<>0 or v_qty_b<>0 then raise exception 'Approbation B : débit incorrect'; end if;
 perform private.set_reservation_status(v_res_b,'annulee'::public.resa_statut);
 perform public.restore_stock(v_res_b);
 select quantite into v_stock from public.stocks where pharmacie_id=x.pharmacie_id and produit_id=x.produit_id;
 select quantite into v_qty_a from public.stocks_lots where id=x.lot_a_id;
 select quantite into v_qty_b from public.stocks_lots where id=x.lot_b_id;
 if v_stock<>5 or v_qty_a<>0 or v_qty_b<>5 then raise exception 'Annulation B : restitution incorrecte'; end if;
 if not exists(select 1 from public.reservations where id=v_res_b and stock_restored and not stock_decremented and statut='annulee') then raise exception 'Annulation B : idempotence non tracée'; end if;
end;
$e2e$;

rollback;
select '20261104140000_credit_marketplace_approval_stock_debit PASS' as resultat;

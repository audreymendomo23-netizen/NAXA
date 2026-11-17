-- NAXA — test d'intégration Replay : trigger d'événements + paiement Marketplace/POS complet.
-- À exécuter uniquement sur le projet Replay avec les comptes E2E nommés ci-dessous.
-- La transaction est entièrement annulée : aucune vente, réservation, session ou mutation de stock ne persiste.

begin;

create temporary table naxa_payment_flow_test_result (
  reservation_id uuid,
  vente_id uuid,
  ticket text,
  montant_fcfa integer,
  event_count integer,
  historique_client_lignes integer,
  stock_avant integer,
  stock_apres integer,
  caisse_ecart integer
) on commit drop;

do $naxa_payment_flow_test$
declare
  v_client constant uuid := 'dcb2242b-50fb-46c8-8c90-e01d42fa4175'; -- naxa_e2e_acheteur
  v_stock_manager constant uuid := '4482efd6-5526-4991-8a20-a63409128733'; -- naxa_e2e_expiry_responsable
  v_cashier constant uuid := '875507d2-cdb8-4166-9c19-b243934f2177'; -- naxa_e2e_expiry_stock
  v_pharmacy constant uuid := '1a4f1ce5-cccf-477e-9a5b-474c8c9fc713';
  v_cashbox constant uuid := '7bd016f7-f953-4aaf-9177-b11fa977da29';
  v_product constant uuid := 'dfd7313c-46a4-455a-b67d-50f0ce2a3686';
  v_transactions jsonb;
  v_reservation uuid;
  v_trigger_reservation uuid := gen_random_uuid();
  v_session uuid;
  v_code text;
  v_sale record;
  v_close record;
  v_history_count integer;
  v_event_count integer;
  v_stock_before integer;
  v_stock_after integer;
  v_original_visibility boolean;
begin
  if position('to_value' in lower(pg_get_functiondef('public.log_reservation_event()'::regprocedure))) > 0 then
    raise exception 'Régression : log_reservation_event référence encore to_value';
  end if;
  if position('payment_verified' in lower(pg_get_functiondef('public.log_reservation_event()'::regprocedure))) = 0
     or position('delivery_status_changed' in lower(pg_get_functiondef('public.log_reservation_event()'::regprocedure))) = 0 then
    raise exception 'Régression : événements paiement vérifié ou livraison supprimés';
  end if;

  perform set_config('request.jwt.claim.role','authenticated',true);
  select visible_recherche into v_original_visibility
  from public.pharmacies where id=v_pharmacy for update;
  if not found or v_original_visibility then
    raise exception 'La pharmacie interne Replay doit être masquée avant la recette';
  end if;
  if exists(select 1 from public.caisses_sessions where caisse_id=v_cashbox and statut='ouverte') then
    raise exception 'Une session de caisse est déjà ouverte ; recette interrompue sans la modifier';
  end if;
  select quantite into v_stock_before
  from public.stocks where pharmacie_id=v_pharmacy and produit_id=v_product for update;
  if v_stock_before < 1 then raise exception 'Stock initial insuffisant'; end if;

  -- Cas de régression exact : INSERT d'une réservation portant déjà une référence.
  perform set_config('request.jwt.claim.sub',v_client::text,true);
  insert into public.reservations(id,client_id,pharmacie_id,statut,total,paiement_ref,mode)
  values(v_trigger_reservation,v_client,v_pharmacy,'en_attente',100,'NAXA-E2E-TRIGGER-REFERENCE','reservation');
  if not exists(
    select 1 from public.reservation_events
    where reservation_id=v_trigger_reservation
      and event_type='payment_declared'
      and paiement_ref='NAXA-E2E-TRIGGER-REFERENCE'
  ) then raise exception 'La référence initiale n''est pas historisée dans paiement_ref'; end if;
  delete from public.reservations where id=v_trigger_reservation;

  -- Parcours Client réel : le RPC métier crée la réservation et son hold de stock.
  update public.pharmacies set visible_recherche=true where id=v_pharmacy;
  v_transactions := public.creer_transactions_client(
    v_pharmacy,
    jsonb_build_array(jsonb_build_object('produit_id',v_product,'quantite',1,'mode','reservation')),
    'especes_retrait',
    '{}'::jsonb
  );
  v_reservation := (v_transactions->0->>'id')::uuid;
  if v_reservation is null then raise exception 'La transaction Client n''a pas créé de réservation'; end if;
  select code_paiement into v_code from public.reservations where id=v_reservation;
  if v_code is null or length(v_code)<6 then raise exception 'Code de paiement Marketplace absent'; end if;

  -- Le Gestionnaire de stock confirme la réservation via sa propre identité métier.
  perform set_config('request.jwt.claim.sub',v_stock_manager::text,true);
  if not public.gestionnaire_stock_reservation_confirmer(v_reservation) then
    raise exception 'Confirmation Gestionnaire de stock refusée';
  end if;

  -- La Caisse ouvre sa session et réalise l'encaissement POS avec le code généré.
  perform set_config('request.jwt.claim.sub',v_cashier::text,true);
  v_session := public.caisse_ouvrir(v_cashbox,0);
  select * into v_sale
  from public.vente_reservation_encaisser(v_reservation,v_session,1000,'especes',v_code);
  if v_sale.vente_id is null or v_sale.numero_vente is null
     or v_sale.total<>1000 or v_sale.monnaie_rendue<>0 then
    raise exception 'Résultat POS incorrect : %',row_to_json(v_sale);
  end if;

  if not exists(
    select 1 from public.reservations r
    where r.id=v_reservation and r.statut='payee'
      and r.paiement_statut='effectue' and r.paiement_mode='especes_retrait'
      and r.paiement_ticket_numero=v_sale.numero_vente
      and r.paiement_montant_percu=1000 and r.paiement_valide_at is not null
  ) then raise exception 'Réservation ou reçu Client incomplet'; end if;

  select count(*) into v_event_count from public.reservation_events
  where reservation_id=v_reservation
    and event_type in ('payment_declared','payment_verified','status_changed');
  if v_event_count < 3 then raise exception 'Historique des transitions de paiement incomplet'; end if;

  perform set_config('request.jwt.claim.sub',v_client::text,true);
  select count(*) into v_history_count from public.client_achats
  where reservation_id=v_reservation;
  if v_history_count < 1 then raise exception 'Achat payé absent de l''historique Client'; end if;

  select quantite into v_stock_after from public.stocks
  where pharmacie_id=v_pharmacy and produit_id=v_product;
  if v_stock_after <> v_stock_before - 1 then
    raise exception 'Débit stock incorrect : avant %, après %',v_stock_before,v_stock_after;
  end if;

  perform set_config('request.jwt.claim.sub',v_cashier::text,true);
  select * into v_close from public.caisse_cloturer(v_session,1000);
  if v_close.total_theorique<>1000 or v_close.total_compte<>1000 or v_close.ecart<>0 then
    raise exception 'Clôture de caisse incorrecte : %',row_to_json(v_close);
  end if;

  insert into pg_temp.naxa_payment_flow_test_result values(
    v_reservation,v_sale.vente_id,v_sale.numero_vente,1000,
    v_event_count,v_history_count,v_stock_before,v_stock_after,v_close.ecart
  );
end;
$naxa_payment_flow_test$;

select * from pg_temp.naxa_payment_flow_test_result;

rollback;

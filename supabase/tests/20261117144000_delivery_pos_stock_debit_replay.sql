-- NAXA — Replay E2E commande multi-pharmacies et débit POS réel.
-- Comptes existants : Client naxa_e2e_acheteur, Stock naxa_e2e_stock,
-- Caisse naxa_e2e_caisse, Livreur naxa_e2e_livreur.
-- Les deux commandes, devis, mouvements et sessions sont annulés par ROLLBACK.
BEGIN;

CREATE TEMP TABLE naxa_delivery_stock_test_result (
  commande_annulee uuid,
  commande_livree uuid,
  vente_id uuid,
  stock_a_avant integer,
  stock_a_apres integer,
  disponible_a_apres_annulation integer,
  stock_b_avant integer,
  stock_b_apres integer,
  statut_commande_b text,
  stock_decremented boolean,
  caisse_ecart integer
) ON COMMIT DROP;

DO $naxa_delivery_stock_test$
DECLARE
  v_client constant uuid := 'dcb2242b-50fb-46c8-8c90-e01d42fa4175';
  v_stock constant uuid := '5f03b180-2605-4de4-8161-f719ce24ae82';
  v_cashier constant uuid := '314ef1f3-7d48-4341-abee-f0c3bba53323';
  v_courier constant uuid := 'f5d02d2b-2286-4dac-becc-f13ba84d78ad';
  v_pharmacy_a constant uuid := '1a4f1ce5-cccf-477e-9a5b-474c8c9fc713';
  v_pharmacy_b constant uuid := '76dd4983-273a-4a83-ae3d-9a7838d3aa35';
  v_product constant uuid := 'dfd7313c-46a4-455a-b67d-50f0ce2a3686';
  v_cashbox constant uuid := 'c3194cf5-7de3-4b90-9412-416b50e7ccbf';
  v_lat_a double precision;
  v_lng_a double precision;
  v_lat_b double precision;
  v_lng_b double precision;
  v_stock_a_before integer;
  v_stock_a_after integer;
  v_available_a integer;
  v_stock_b_before integer;
  v_stock_b_after integer;
  v_items jsonb;
  v_address jsonb;
  v_result jsonb;
  v_order_a uuid;
  v_order_b uuid;
  v_code text;
  v_mission uuid;
  v_session uuid;
  v_sale record;
  v_close record;
  v_status text;
  v_decremented boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.role','authenticated',true);

  -- Préconditions sans toucher à une session de caisse déjà ouverte.
  IF EXISTS(SELECT 1 FROM public.caisses_sessions WHERE caisse_id=v_cashbox AND statut='ouverte') THEN
    RAISE EXCEPTION 'Session Caisse Mvan déjà ouverte : test interrompu sans modification';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.naxa_profile_active_roles WHERE profile_id=v_stock AND role_code='gestionnaire_stock' AND pharmacie_id=v_pharmacy_b)
     OR NOT EXISTS(SELECT 1 FROM public.naxa_profile_active_roles WHERE profile_id=v_cashier AND role_code='caisse' AND pharmacie_id=v_pharmacy_b)
     OR NOT EXISTS(SELECT 1 FROM public.naxa_profile_active_roles WHERE profile_id=v_courier AND role_code='livreur' AND pharmacie_id=v_pharmacy_b) THEN
    RAISE EXCEPTION 'Affectations actives Stock/Caisse/Livreur Replay incomplètes';
  END IF;

  SELECT lat,lng INTO v_lat_a,v_lng_a FROM public.pharmacies WHERE id=v_pharmacy_a AND actif AND archivee_le IS NULL;
  SELECT lat,lng INTO v_lat_b,v_lng_b FROM public.pharmacies WHERE id=v_pharmacy_b AND actif AND archivee_le IS NULL;
  IF v_lat_a IS NULL OR v_lat_b IS NULL THEN RAISE EXCEPTION 'Coordonnées des pharmacies E2E absentes'; END IF;

  SELECT quantite INTO v_stock_a_before FROM public.stocks WHERE pharmacie_id=v_pharmacy_a AND produit_id=v_product FOR UPDATE;
  IF v_stock_a_before IS NULL OR v_stock_a_before<2 THEN RAISE EXCEPTION 'Stock initial Pharmacie A insuffisant'; END IF;

  -- Le stock Mvan est une fixture transactionnelle, pas une donnée persistante.
  INSERT INTO public.stocks(pharmacie_id,produit_id,prix,quantite,date_peremption)
  VALUES(v_pharmacy_b,v_product,1000,3,current_date+90)
  ON CONFLICT(pharmacie_id,produit_id) DO UPDATE
    SET prix=1000,quantite=3,date_peremption=current_date+90,updated_at=now();
  SELECT quantite INTO v_stock_b_before FROM public.stocks WHERE pharmacie_id=v_pharmacy_b AND produit_id=v_product FOR UPDATE;
  IF v_stock_b_before<>3 THEN RAISE EXCEPTION 'Fixture stock Mvan incorrecte'; END IF;

  -- Les deux pharmacies sont activées pour la livraison uniquement dans cette transaction.
  -- Mvan est une fixture demo ; on désactive ce marqueur uniquement dans la transaction pour tester le même garde Marketplace qu'une pharmacie réelle. ROLLBACK le restaure.
  UPDATE public.pharmacies SET visible_recherche=true,est_demo=false,livraison_active=true,rayon_livraison_km=10
  WHERE id IN (v_pharmacy_a,v_pharmacy_b);

  -- Devis routiers Replay valides consommés par le trigger serveur.
  INSERT INTO public.naxa_delivery_quotes(
    client_id,pharmacie_id,latitude_client,longitude_client,latitude_pharmacie,longitude_pharmacie,
    distance_routiere_km,duree_minutes,frais_livraison,fournisseur_itineraire,expire_le
  ) VALUES
    (v_client,v_pharmacy_a,v_lat_a+0.0005,v_lng_a+0.0005,v_lat_a,v_lng_a,1,10,1500,'osrm',now()+interval '1 hour'),
    (v_client,v_pharmacy_b,v_lat_b+0.0005,v_lng_b+0.0005,v_lat_b,v_lng_b,1,10,1500,'osrm',now()+interval '1 hour');

  -- COMMANDE A : même produit, autre propriétaire. Le hold doit disparaître à l'annulation Client.
  PERFORM set_config('request.jwt.claim.sub',v_client::text,true);
  v_items:=jsonb_build_array(jsonb_build_object('produit_id',v_product,'quantite',1,'mode','commande'));
  v_address:=jsonb_build_object('ville','Yaoundé','quartier','Test A','rue','Adresse E2E A','telephone','237600000001',
    'latitude',v_lat_a+0.0005,'longitude',v_lng_a+0.0005);
  v_result:=public.creer_transactions_client(v_pharmacy_a,v_items,null::text,v_address);
  v_order_a:=(v_result->0->>'id')::uuid;
  IF v_order_a IS NULL OR NOT EXISTS(SELECT 1 FROM public.reservations WHERE id=v_order_a AND mode='commande' AND pharmacie_id=v_pharmacy_a) THEN
    RAISE EXCEPTION 'Commande A non persistée pour son propriétaire';
  END IF;
  IF (SELECT quantite FROM public.stocks WHERE pharmacie_id=v_pharmacy_a AND produit_id=v_product)<>v_stock_a_before THEN
    RAISE EXCEPTION 'Le hold A a modifié prématurément le stock physique';
  END IF;
  SELECT o.quantite INTO v_available_a FROM public.marketplace_offre_stock_disponible(v_pharmacy_a,v_product) o;
  IF v_available_a<>v_stock_a_before-1 THEN RAISE EXCEPTION 'Le hold A n''a pas réduit le disponible de sa pharmacie'; END IF;

  PERFORM public.set_reservation_status(v_order_a,'annulee'::public.resa_statut);
  SELECT quantite INTO v_stock_a_after FROM public.stocks WHERE pharmacie_id=v_pharmacy_a AND produit_id=v_product;
  SELECT o.quantite INTO v_available_a FROM public.marketplace_offre_stock_disponible(v_pharmacy_a,v_product) o;
  IF v_stock_a_after<>v_stock_a_before OR v_available_a<>v_stock_a_before THEN
    RAISE EXCEPTION 'Annulation A : stock physique ou disponible non restauré (avant %, physique %, disponible %)',v_stock_a_before,v_stock_a_after,v_available_a;
  END IF;

  -- COMMANDE B : second propriétaire, vraie chaîne Stock -> Livreur -> Caisse -> Client.
  v_address:=jsonb_build_object('ville','Yaoundé','quartier','Mvan','rue','Adresse E2E B','telephone','237600000002',
    'latitude',v_lat_b+0.0005,'longitude',v_lng_b+0.0005);
  v_result:=public.creer_transactions_client(v_pharmacy_b,v_items,null::text,v_address);
  v_order_b:=(v_result->0->>'id')::uuid;
  IF v_order_b IS NULL OR NOT EXISTS(SELECT 1 FROM public.reservations WHERE id=v_order_b AND mode='commande' AND pharmacie_id=v_pharmacy_b) THEN
    RAISE EXCEPTION 'Commande B non persistée pour son propriétaire';
  END IF;
  IF (SELECT quantite FROM public.stocks WHERE pharmacie_id=v_pharmacy_b AND produit_id=v_product)<>v_stock_b_before THEN
    RAISE EXCEPTION 'Le hold B a modifié prématurément le stock physique';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',v_stock::text,true);
  IF NOT public.gestionnaire_stock_confirmer_demande_livraison(v_order_b) THEN RAISE EXCEPTION 'Stock n''a pas accepté la commande B'; END IF;
  PERFORM set_config('request.jwt.claim.sub',v_client::text,true);
  IF NOT public.naxa_client_set_delivery_payment_mode(v_order_b,'especes_livraison') THEN RAISE EXCEPTION 'Choix paiement livraison refusé'; END IF;
  PERFORM set_config('request.jwt.claim.sub',v_stock::text,true);
  IF NOT public.gestionnaire_stock_commande_preparation(v_order_b,'en_preparation') THEN RAISE EXCEPTION 'Démarrage préparation refusé'; END IF;
  IF NOT public.gestionnaire_stock_commande_preparation(v_order_b,'prete_au_retrait') THEN RAISE EXCEPTION 'Confirmation prêt refusée'; END IF;

  SELECT id INTO v_mission FROM public.naxa_delivery_missions WHERE reservation_id=v_order_b;
  IF v_mission IS NULL THEN RAISE EXCEPTION 'Mission Livreur non créée après préparation'; END IF;

  PERFORM set_config('request.jwt.claim.sub',v_courier::text,true);
  IF NOT public.naxa_delivery_accept(v_mission) THEN RAISE EXCEPTION 'Acceptation Livreur refusée'; END IF;
  IF NOT public.naxa_delivery_pickup(v_mission,v_lat_b,v_lng_b,10) THEN RAISE EXCEPTION 'Retrait Livreur refusé'; END IF;
  IF NOT public.naxa_delivery_arrived(v_mission,v_lat_b+0.0005,v_lng_b+0.0005) THEN RAISE EXCEPTION 'Arrivée Livreur refusée'; END IF;
  IF NOT public.naxa_delivery_courier_declare_cash(v_mission,2500) THEN RAISE EXCEPTION 'Déclaration espèces Livreur refusée'; END IF;

  PERFORM set_config('request.jwt.claim.sub',v_cashier::text,true);
  v_session:=public.caisse_ouvrir(v_cashbox,0);
  SELECT code_paiement INTO v_code FROM public.reservations WHERE id=v_order_b;
  SELECT * INTO v_sale FROM public.naxa_delivery_pos_encaisser(v_order_b,v_session,2500,'especes',v_code,NULL);
  IF v_sale.vente_id IS NULL OR v_sale.total<>2500 OR v_sale.monnaie_rendue<>0 THEN
    RAISE EXCEPTION 'Encaissement POS Livraison incorrect';
  END IF;

  SELECT quantite INTO v_stock_b_after FROM public.stocks WHERE pharmacie_id=v_pharmacy_b AND produit_id=v_product;
  SELECT r.commande_statut,r.stock_decremented INTO v_status,v_decremented FROM public.reservations r WHERE r.id=v_order_b;
  IF v_stock_b_after<>v_stock_b_before-1 OR NOT v_decremented THEN
    RAISE EXCEPTION 'Débit physique manquant ou multiple : avant %, après %, stock_decremented %',v_stock_b_before,v_stock_b_after,v_decremented;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.ventes WHERE id=v_sale.vente_id AND stock_decremented_at_draft=true AND statut='payee') THEN
    RAISE EXCEPTION 'La vente POS n''atteste pas le débit physique exécuté';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',v_client::text,true);
  IF NOT public.naxa_delivery_confirm_received(v_mission,'Réception E2E confirmée') THEN RAISE EXCEPTION 'Confirmation Client refusée'; END IF;
  PERFORM set_config('request.jwt.claim.sub',v_courier::text,true);
  IF NOT public.naxa_delivery_confirm_handover(v_mission) THEN RAISE EXCEPTION 'Confirmation remise Livreur refusée'; END IF;
  PERFORM set_config('request.jwt.claim.sub',v_cashier::text,true);
  SELECT * INTO v_close FROM public.caisse_cloturer(v_session,2500);
  IF v_close.total_theorique<>2500 OR v_close.total_compte<>2500 OR v_close.ecart<>0 THEN
    RAISE EXCEPTION 'Écart de caisse inattendu après commande B';
  END IF;

  IF NOT EXISTS(SELECT 1 FROM public.reservations WHERE id=v_order_b AND statut='payee' AND commande_statut='livree' AND stock_decremented AND consumed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Commande B non clôturée ou stock non consommé';
  END IF;

  INSERT INTO pg_temp.naxa_delivery_stock_test_result
  VALUES(v_order_a,v_order_b,v_sale.vente_id,v_stock_a_before,v_stock_a_after,v_available_a,
    v_stock_b_before,v_stock_b_after,v_status,v_decremented,v_close.ecart);
END;
$naxa_delivery_stock_test$;

SELECT * FROM pg_temp.naxa_delivery_stock_test_result;
ROLLBACK;

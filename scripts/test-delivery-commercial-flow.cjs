const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const files = {
  pricing: read("src/lib/delivery-pricing.ts"),
  routing: read("src/lib/server/delivery-routing.ts"),
  pricingTest: read("scripts/test-delivery-pricing.cjs"),
  tariffSql: read("supabase/migrations/20261107150000_delivery_progressive_zone_tariffs.sql"),
  adminDeliveries: read("src/app/admin/livraisons/page.tsx"),
  promoterDeliveries: read("src/app/pharmacie/promoteur/livraisons/page.tsx"),
  checkout: read("src/app/commande/nouvelle/page.tsx"),
  stockPage: read("src/app/pharmacie/gestionnaire-stock/commandes/page.tsx"),
  stockAction: read("src/app/pharmacie/gestionnaire-stock/livraison-actions.ts"),
  pharmacyOrders: read("src/app/pharmacie/commandes/page.tsx"),
  paymentSelector: read("src/components/DeliveryPaymentSelector.tsx"),
  paymentApi: read("src/app/api/pay/[id]/route.ts"),
  paymentValidation: read("src/components/pharmacie/DeliveryPaymentValidationPanel.tsx"),
  cashierPage: read("src/app/pharmacie/caisse/page.tsx"),
  courier: read("src/components/pharmacie/LivreurWorkspaceClient.tsx"),
  signature: read("src/components/DeliveryClientSignaturePad.tsx"),
  clientTracking: read("src/components/SuiviLivraison.tsx"),
  pharmacyTracking: read("src/components/SuiviLivraisonPharmacie.tsx"),
  review: read("src/components/DeliveryReviewForm.tsx"),
  config: read("src/components/PharmacyDeliveryConfig.tsx"),
  zoneConfig: read("src/components/DeliveryTariffZoneConfig.tsx"),
  report: read("src/components/DeliveryCommissionReport.tsx"),
  createSql: read("supabase/migrations/20261107094500_delivery_distance_signature_commission_20261107.sql"),
  quoteSql: read("supabase/migrations/20261107240000_delivery_server_route_quotes_national_tariffs.sql"),
  stockSql: read("supabase/migrations/20261107101500_delivery_stock_acceptance_payment_dispatch_20261107.sql"),
  paymentSql: read("supabase/migrations/20261107105000_delivery_payment_reference_declaration_20261107.sql"),
  trackingSql: read("supabase/migrations/20261107111500_delivery_tracking_both_apps_20261107.sql"),
  reviewSql: read("supabase/migrations/20261107120000_delivery_reviews_and_commission_scope_20261107.sql"),
  posSql: read("supabase/migrations/20261107133000_delivery_pos_cash_collection_and_monthly_due_20261107.sql"),
  courierSql: read("supabase/migrations/20261107141000_delivery_courier_cash_and_eta_mission_data.sql"),
  settlementSql: read("supabase/migrations/20261107144500_delivery_subscription_commission_settlement_trigger.sql"),
};

test("le devis routier applique les tranches progressives et les zones tout en conservant 500 FCFA pour NAXA", () => {
  assert.match(files.pricing, /FRAIS_LIVRAISON_MIN\\s*=\\s*1500/);
  assert.match(files.pricing, /FRAIS_LIVRAISON_MAX_STANDARD\\s*=\\s*3500/);
  assert.match(files.pricing, /COMMISSION_NAXA_LIVRAISON\\s*=\\s*500/);
  assert.match(files.pricingTest, /calculerFraisLivraison\\(3\\), 1550/);
  assert.match(files.pricingTest, /calculerFraisLivraison\\(20, "eloignee", 700\\), 5200/);
  assert.match(files.pricingTest, /commissionNaxa: 500/);
  assert.match(files.routing, /return calculerFraisLivraison\\(distanceKm, zoneType, supplementZoneFcfa\\)/);
  assert.match(files.createSql, /check \\(commission_naxa = 500\\)/);
  assert.match(files.quoteSql, /new\\.frais_livraison := v_quote\\.frais_livraison/);
  assert.match(files.tariffSql, /frais_livraison between 1500 and 20000/);
  assert.match(files.tariffSql, /v_r\\.frais_livraison between 1500 and 20000/);
  assert.match(files.tariffSql, /naxa_delivery_tariff_zones/);
  assert.match(files.zoneConfig, /naxa_delivery_tariff_zones/);
  assert.match(files.adminDeliveries, /DeliveryTariffZoneConfig/);
  assert.match(files.tariffSql, /solde_livraison/);
});

test("le Client demande la livraison avant paiement et choisit le paiement seulement après confirmation Stock", () => {
  assert.match(files.checkout, /p_paiement_mode:\s*delivery\s*\?\s*null/);
  assert.match(files.checkout, /Demande de livraison envoyée/);
  assert.match(files.stockAction, /gestionnaire_stock_confirmer_demande_livraison/);
  assert.match(files.paymentSelector, /if\s*\(!stockConfirmedAt\)/);
  assert.match(files.stockSql, /livraison_confirmee_stock_at=coalesce/);
  assert.match(files.stockSql, /delivery_payment_request/);
});

test("Stock notifie les Livreurs immédiatement, mais le retrait attend paiement et préparation", () => {
  assert.match(files.stockSql, /naxa_delivery_make_available\(p_reservation\)/);
  assert.match(files.stockSql, /insert into public.notifications\(user_id,type,titre,corps,reservation_id,related_entity_id\)/);
  assert.match(files.stockSql, /v_r\.preparation_statut<>'prete_au_retrait'/);
  assert.match(files.stockSql, /Paiement électronique non vérifié/);
  assert.match(files.courier, /naxa_delivery_accept/);
});

test("la Caisse valide le paiement dans le POS complet sans double décrément de stock", () => {
  assert.match(files.paymentSql, /naxa_client_declarer_paiement_livraison/);
  assert.match(files.posSql, /naxa_delivery_pos_encaisser/);
  assert.match(files.posSql, /stock_decremented_at_draft\s*\)\s*values[\s\S]*true/);
  assert.match(files.posSql, /insert into public\.vente_lignes/);
  assert.match(files.posSql, /insert into public\.vente_paiements/);
  assert.match(files.paymentValidation, /naxa_delivery_pos_encaisser/);
  assert.match(files.cashierPage, /DeliveryPaymentValidationPanel/);
});

test("les espèces à la remise sont déclarées par le Livreur puis rapprochées par la Caisse", () => {
  assert.match(files.posSql, /naxa_delivery_courier_declare_cash/);
  assert.match(files.posSql, /cash_declared/);
  assert.match(files.courier, /naxa_delivery_courier_declare_cash/);
  assert.match(files.courier, /cashReceived/);
  assert.match(files.paymentValidation, /cash_received/);
});

test("la livraison ne se clôture qu'après paiement et confirmations Client + Livreur", () => {
  assert.match(files.createSql, /v_m\.client_confirme_at is null or v_m\.livreur_confirme_at is null/);
  assert.match(files.posSql, /if v_r\.paiement_statut<>'effectue' then return false/);
  assert.match(files.clientTracking, /naxa_delivery_confirm_received/);
  assert.match(files.courier, /naxa_delivery_confirm_handover/);
  assert.match(files.signature, /naxa_delivery_confirm_signature/);
  assert.match(files.createSql, /signature_client_traces=p_strokes/);
});

test("le suivi géographique est consultable côté Client et côté pharmacie", () => {
  assert.match(files.clientTracking, /export function SuiviLivraison/);
  assert.match(files.pharmacyTracking, /naxa_delivery_pharmacy_tracking/);
  assert.match(files.pharmacyOrders, /SuiviLivraisonPharmacie/);
  assert.match(files.courierSql, /livraison_echeance_at/);
  assert.match(files.clientTracking, /setInterval/);
  assert.match(files.pharmacyTracking, /setInterval/);
});

test("les frais sont montrés au Client sans dévoiler la commission NAXA", () => {
  assert.match(files.paymentSelector, /Livraison\s*:/);
  assert.doesNotMatch(files.paymentSelector, /commission_naxa|commission NAXA/i);
  assert.doesNotMatch(files.checkout, /commission NAXA|commission de plateforme/i);
  assert.match(files.pharmacyOrders, /frais_livraison/);
  assert.match(files.report, /500 FCFA par livraison terminée/);
  assert.match(files.adminDeliveries, /DeliveryCommissionReport/);
  assert.match(files.promoterDeliveries, /DeliveryCommissionReport/);
});

test("les commissions sont uniques, rapportées par pharmacie/région et rapprochées avec l'abonnement mensuel", () => {
  assert.match(files.createSql, /reservation_id uuid not null unique/);
  assert.match(files.createSql, /on conflict\(mission_id\) do nothing/);
  assert.match(files.posSql, /naxa_delivery_monthly_due/);
  assert.match(files.settlementSql, /montant_mensuel/);
  assert.match(files.settlementSql, /new\.montant>=v_base_due\+v_commission_due/);
  assert.match(files.report, /naxa_delivery_monthly_due/);
  assert.match(files.reviewSql, /v_role<>'promoteur'/);
});

test("les nouveaux composants et pages TSX sont syntaxiquement valides", () => {
  const targets = [
    "src/app/commande/nouvelle/page.tsx",
    "src/app/pharmacie/gestionnaire-stock/commandes/page.tsx",
    "src/app/pharmacie/gestionnaire-stock/livraison-actions.ts",
    "src/app/pharmacie/commandes/page.tsx",
    "src/app/pharmacie/caisse/page.tsx",
    "src/components/DeliveryPaymentSelector.tsx",
    "src/components/pharmacie/DeliveryPaymentValidationPanel.tsx",
    "src/components/pharmacie/LivreurWorkspaceClient.tsx",
    "src/components/DeliveryClientSignaturePad.tsx",
    "src/components/SuiviLivraison.tsx",
    "src/components/SuiviLivraisonPharmacie.tsx",
    "src/components/DeliveryReviewForm.tsx",
    "src/components/PharmacyDeliveryConfig.tsx",
    "src/components/DeliveryCommissionReport.tsx",
    "src/app/reservation/[id]/page.tsx",
    "src/app/admin/livraisons/page.tsx",
    "src/app/pharmacie/promoteur/livraisons/page.tsx",
  ];
  for (const file of targets) {
    const source = read(file);
    const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
    assert.equal(parsed.parseDiagnostics.length, 0, file + ": " + parsed.parseDiagnostics.map(d=>d.messageText).join("; "));
  }
});
process.stdout.write("Contrats du parcours livraison et paiement NAXA vérifiés.\n");

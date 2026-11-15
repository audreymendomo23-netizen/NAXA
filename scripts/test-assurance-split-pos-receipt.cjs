"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const paymentGuard = fs.readFileSync(
  path.join(root, "supabase/migrations/20261115134500_allow_split_pos_payments_for_reservations.sql"),
  "utf8"
);
const receiptSnapshot = fs.readFileSync(
  path.join(root, "supabase/migrations/20261115140000_fix_reservation_receipt_snapshot_split_payments.sql"),
  "utf8"
);
const paymentContract = fs.readFileSync(
  path.join(root, "supabase/tests/20261115134500_split_pos_reservation_payment_contract.sql"),
  "utf8"
);
const receiptContract = fs.readFileSync(
  path.join(root, "supabase/tests/20261115140000_reservation_receipt_snapshot_split_payments.sql"),
  "utf8"
);
const runtime = fs.readFileSync(
  path.join(root, "supabase/tests/20261115130000_assurance_marketplace_pos_ticket_reimbursement_runtime.sql"),
  "utf8"
);

test("le passage d'une réservation à payée agrège toutes les lignes POS", () => {
  assert.match(paymentGuard, /sum\(vp\.montant\)/i);
  assert.match(paymentGuard, /v\.total_net = r\.total/);
  assert.match(paymentGuard, /exists\s*\(\s*select 1 from public\.vente_paiements/i);
  assert.doesNotMatch(paymentGuard, /vp\.montant\s*=\s*r\.total/i);
  assert.match(paymentContract, /split_pos_reservation_payment_contract PASS/);
});

test("le snapshot de reçu sélectionne uniquement le paiement client, jamais la créance Assurance", () => {
  assert.match(receiptSnapshot, /not like 'ASSURANCE:%'/i);
  assert.match(receiptSnapshot, /coalesce\(p\.montant_percu,p\.montant,0\)/i);
  assert.match(receiptSnapshot, /v_canal:='a_convenir'/);
  assert.match(receiptSnapshot, /v_percu:=0/);
  assert.match(receiptSnapshot, /v_monnaie:=0/);
  assert.match(receiptContract, /reservation_receipt_snapshot_split_payments PASS/);
});

test("le runtime couvre partage Client/Assureur, monnaie rendue, ticket, remboursements et rollback", () => {
  assert.match(runtime, /vente_reservation_encaisser/);
  assert.match(runtime, /'ASSURANCE:%'/);
  assert.match(runtime, /get_client_reservation_ticket/);
  assert.match(runtime, /assurance_enregistrer_remboursement/);
  assert.match(runtime, /'gross_fcfa',10000/);
  assert.match(runtime, /'insurer_fcfa',5500/);
  assert.match(runtime, /'client_fcfa',4500/);
  assert.match(runtime, /'all_fixtures_rolled_back',true/);
  assert.match(runtime, /rollback/i);
});

test("le runtime réutilise des identités Replay existantes et ne crée aucun utilisateur Auth", () => {
  assert.match(runtime, /naxa_select_active_role\\('responsable'/);
  assert.match(runtime, /naxa_select_active_role\\('caisse'/);
  assert.match(runtime, /naxa_professional_assignments/);
  assert.doesNotMatch(runtime, /insert into auth\\.users/i);
});

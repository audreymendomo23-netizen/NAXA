"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { assertReplayUrl } = require("./e2e/verify-credit-refund-runtime.cjs");

const runtimeSource = fs.readFileSync(
  path.join(__dirname, "e2e/verify-credit-refund-runtime.cjs"),
  "utf8",
);

test("credit refund runtime E2E is pinned to the NAXA Replay project", () => {
  assert.equal(
    assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co"),
    "https://pwfftcsjyeibxxqhwysw.supabase.co",
  );
});

test("credit refund runtime E2E refuses Production and non-HTTPS endpoints", () => {
  assert.throws(() => assertReplayUrl("https://eouwtuusnsuxaejsxknf.supabase.co"), /limité au projet Replay/);
  assert.throws(() => assertReplayUrl("http://pwfftcsjyeibxxqhwysw.supabase.co"), /limité au projet Replay/);
  assert.throws(() => assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co/other"), /limité au projet Replay/);
});

test("credit refund runtime covers the three channels, each with an independent idempotency key", () => {
  for (const channel of ["especes", "orange_money", "mtn_momo"]) {
    assert.ok(runtimeSource.includes('channel: "' + channel + '"'), "Missing channel " + channel);
    assert.ok(runtimeSource.includes("idempotencyByChannel[plan.channel]"), "Missing idempotency for " + channel);
  }
  assert.match(runtimeSource, /p_idempotency_key:\s*idempotencyKey/);
  assert.match(runtimeSource, /p_verification_beneficiaire:\s*plan\.verify/);
  assert.match(runtimeSource, /p_verification_montant:\s*plan\.verify/);
  assert.match(runtimeSource, /p_confirmation_client_vue:\s*plan\.verify/);
});

test("credit refund runtime verifies atomic treasury movements, origin, accounting outbox and Caisse drawer scope", () => {
  assert.match(runtimeSource, /caisse_credit_tresorerie_compte_creer/);
  assert.match(runtimeSource, /caisse_credit_tresorerie_comptes_lister/);
  assert.match(runtimeSource, /tresorerie_mouvements\?select=id,compte_id,nature,montant,source_type,source_id,canal_paiement,origine/);
  assert.match(runtimeSource, /movement\.origine !== "comptoir"/);
  assert.match(runtimeSource, /compta_evenement\?select=id,evenement_type,source_type,source_id,donnees/);
  assert.match(runtimeSource, /cashDrawerTotal !== 100/);
  assert.match(runtimeSource, /totalAllRefunds !== 600/);
});

test("credit refund runtime safely refuses invalid proof, missing account, overbalance and mismatched idempotency", () => {
  assert.match(runtimeSource, /idempotencyConflictRejected/);
  assert.match(runtimeSource, /missingProofRejected/);
  assert.match(runtimeSource, /missingAccountRejected/);
  assert.match(runtimeSource, /balanceExceededRejected/);
  assert.match(runtimeSource, /discoveryComplete/);
  assert.match(runtimeSource, /remainingMovements/);
  assert.match(runtimeSource, /remainingEvents/);
});

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
  }
  assert.match(runtimeSource, /idempotencyByChannel\[plan\.channel\]/);
  assert.match(runtimeSource, /p_idempotency_key:\s*idempotencyKey/);
  assert.match(runtimeSource, /p_verification_beneficiaire:\s*plan\.verify/);
  assert.match(runtimeSource, /p_verification_montant:\s*plan\.verify/);
  assert.match(runtimeSource, /p_confirmation_client_vue:\s*plan\.verify/);
  assert.match(runtimeSource, /replayedId !== id/);
});

test("credit refund runtime reuses existing channel accounts without claiming or deleting them", () => {
  assert.match(runtimeSource, /existingRows\.length > 1/);
  assert.match(runtimeSource, /const expectedType = plan\.channel === "especes" \? "especes" : "mobile_money"/);
  assert.match(runtimeSource, /if \(existingRows\.length === 1\)/);
  assert.match(runtimeSource, /treasuryAccountIds\.push\(id\)/);
  assert.doesNotMatch(runtimeSource, /Des comptes de trésorerie existent déjà pour un canal/);
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

test("credit refund runtime reuses only a zero-balance active credit and restores it after cleanup", () => {
  assert.match(runtimeSource, /existingCredits\.length > 1/);
  assert.match(runtimeSource, /existingCredit\.actif !== true/);
  assert.match(runtimeSource, /Number\(existingCredit\.solde\) !== 0/);
  assert.match(runtimeSource, /creditCreatedByRuntime = false/);
  assert.match(runtimeSource, /creditOriginalBalance = Number\(existingCredit\.solde\)/);
  assert.match(runtimeSource, /creditCreatedByRuntime = true/);
  assert.match(runtimeSource, /body: \{ solde: creditOriginalBalance \}/);
  assert.match(runtimeSource, /remainingCredits\.length !== 1/);
});

test("credit refund runtime rejects invalid states and performs guarded cleanup on Replay", () => {
  assert.match(runtimeSource, /idempotencyConflictRejected/);
  assert.match(runtimeSource, /missingProofRejected/);
  assert.match(runtimeSource, /missingAccountRejected/);
  assert.match(runtimeSource, /balanceExceededRejected/);
  assert.match(runtimeSource, /discoveryComplete/);
  assert.match(runtimeSource, /remainingMovements/);
  assert.match(runtimeSource, /remainingEvents/);
  assert.match(runtimeSource, /assertReplayUrl/);
});

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "e2e/verify-credit-pos-browser.cjs"),
  "utf8",
);

test("la recette navigateur crédit est épinglée à Replay uniquement", () => {
  assert.match(source, /const PROJECT_REF = "pwfftcsjyeibxxqhwysw"/);
  assert.match(source, /function assertReplayUrl\(value\)/);
  assert.match(source, /url\.hostname !== PROJECT_REF \+ "\.supabase\.co"/);
  assert.match(source, /assertReplayUrl\(env\.NAXA_STORAGE_E2E_URL \|\| env\.SUPABASE_URL\)/);
});

test("la recette navigateur couvre refus avant décision, reprise du même brouillon et stock unitaire", () => {
  assert.match(source, /Dépassement du plafond/);
  assert.match(source, /Approuver le crédit comptoir/);
  assert.match(source, /Finaliser la vente à crédit/);
  assert.match(source, /stockBeforeApproval/);
  assert.match(source, /stockAfterApproval/);
  assert.match(source, /stockAfterSale/);
});

test("la recette couvre le remboursement réel, l'outbox et le rapprochement Caisse", () => {
  assert.match(source, /client_credit_rembourser/);
  assert.match(source, /credit_remboursement/);
  assert.match(source, /caisse_cloturer/);
  assert.match(source, /Number\(closed\.ecart\) !== 0/);
  assert.match(source, /balanceAfterRefund/);
});

test("la pharmacie de recette reste active et masquée au catalogue public", () => {
  assert.match(source, /visible_recherche !== false/);
  assert.match(source, /archivee_le !== null/);
  assert.match(source, /Aucun produit\/offre public n'est créé/);
});

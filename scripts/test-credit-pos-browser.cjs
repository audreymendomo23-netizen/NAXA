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
  assert.match(source, /getByText\("Achat à crédit", \{ exact: false \}\)\.first\(\)\.waitFor\(\)/);
  assert.match(source, /name: "Mes reçus de remboursement"/);
  assert.match(source, /refundReceiptHeading\.count\(\) !== 1/);
  assert.match(source, /refundReceiptHeading\.waitFor\(\{ state: "visible" \}\)/);
  assert.match(source, /stockBeforeApproval/);
  assert.match(source, /stockAfterApproval/);
  assert.match(source, /stockAfterSale/);
  assert.match(source, /getByText\("Session ouverte", \{ exact: true \}\)/);
});

test("la recette soumet le remboursement depuis l'interface Caisse et vérifie reçu, trésorerie et clôture", () => {
  assert.match(source, /refundSection/);
  assert.match(source, /Confirmer le remboursement/);
  assert.match(source, /NAXA · Reçu de remboursement crédit/);
  assert.match(source, /client_credit_rembourser/);
  assert.match(source, /credit_remboursement/);
  assert.match(source, /caisse_cloturer/);
  assert.match(source, /Number\(closed\.ecart\) !== 0/);
  assert.match(source, /accountAfterRefund/);
  assert.match(source, /caisse_credit_tresorerie_compte_creer/);
  assert.match(source, /tresorerie_mouvements/);
  assert.match(source, /refundReference/);
});

test("la pharmacie de recette reste active et masquée au catalogue public", () => {
  assert.match(source, /visible_recherche !== false/);
  assert.match(source, /archivee_le !== null/);
  assert.match(source, /aucun produit\/offre public n'est créé/i);
});

test("la recette navigateur respecte les deux preuves locales de déclaration d’âge", () => {
  assert.match(source, /naxa-age-status-v2/);
  assert.match(source, /naxa-age-declaration-v1/);
  assert.match(source, /waitFor\(\{ state: "visible", timeout: 30000 \}\)/);
});

test("les serveurs locaux de recette fournissent un secret anti-bruteforce éphémère", () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, "../.github/workflows/naxa-replay-promoteur-secret-safe-v2.yml"),
    "utf8",
  );
  assert.equal((workflow.match(/NAXA_RATE_LIMIT_SECRET="\$\(openssl rand -hex 32\)"\r?\n\s*export NAXA_RATE_LIMIT_SECRET/g) || []).length, 2);
  assert.equal((workflow.match(/echo "::add-mask::\$NAXA_RATE_LIMIT_SECRET"/g) || []).length, 2);
});

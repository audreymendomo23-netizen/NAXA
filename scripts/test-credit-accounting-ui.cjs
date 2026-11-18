"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../src/components/pharmacie/ComptaPlanManager.tsx"),
  "utf8",
);

test("le plan comptable expose les événements d'octroi et de remboursement du crédit", () => {
  assert.match(source, /value: "credit_octroi", label: "Octroi de crédit client"/);
  assert.match(source, /value: "credit_remboursement", label: "Remboursement de crédit client"/);
});

test("les deux événements crédit sont inclus dans les choix de journaux et mappings", () => {
  assert.match(source, /const ACCOUNTING_EVENTS = \[/);
  assert.match(source, /const MAPPING_EVENTS = ACCOUNTING_EVENTS\.filter\(item => item\.value !== "vente_annulee"\)/);
  assert.match(source, /ACCOUNTING_EVENTS\.map/);
  assert.match(source, /MAPPING_EVENTS\.map/);
});

const marketplaceSource = fs.readFileSync(
  path.join(__dirname, "e2e/verify-credit-marketplace-browser.cjs"),
  "utf8",
);
const accountingBrowserSource = fs.readFileSync(
  path.join(__dirname, "e2e/verify-credit-accounting-browser.cjs"),
  "utf8",
);

test("la recette Marketplace utilise uniquement Replay et restaure le masquage", () => {
  assert.match(marketplaceSource, /const PROJECT_REF = "pwfftcsjyeibxxqhwysw"/);
  assert.match(marketplaceSource, /visible_recherche: true/);
  assert.match(marketplaceSource, /visible_recherche: false/);
  assert.match(marketplaceSource, /naxa-age-status-v2/);
  assert.match(marketplaceSource, /Soumettre la demande de crédit/);
  assert.match(marketplaceSource, /Demande transmise/);
  assert.match(marketplaceSource, /p_approuver: false/);
});

test("la recette de configuration comptable passe par le Promoteur et valide les quatre mappings", () => {
  assert.match(accountingBrowserSource, /compta_plan_lister_pharmacies/);
  assert.match(accountingBrowserSource, /createAndValidateAccount/);
  assert.match(accountingBrowserSource, /createAndValidateJournal/);
  assert.match(accountingBrowserSource, /createAndValidateMapping/);
  assert.match(accountingBrowserSource, /credit_octroi/);
  assert.match(accountingBrowserSource, /credit_remboursement/);
  assert.match(accountingBrowserSource, /Valider mapping/);
  assert.match(accountingBrowserSource, /compta_periodes/);
  assert.match(accountingBrowserSource, /Ouvrir une vraie période mensuelle/);
  assert.match(accountingBrowserSource, /const debitCode = "NAXAE2ECD"/);
  assert.match(accountingBrowserSource, /const creditCode = "NAXAE2ECC"/);
  assert.match(accountingBrowserSource, /configuration comptable de la seule pharmacie technique Replay est conservée/);
  assert.match(source, /compta_plan_valider_compte/);
  assert.match(source, /compta_config_valider_journal/);
  assert.match(source, /compta_plan_valider_mapping/);
});

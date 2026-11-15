"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { assertReplayUrl, PHARMACY_ID, PRODUCT_NAME } = require("./e2e/verify-credit-pos-browser.cjs");

test("le parcours navigateur crédit refuse tout projet autre que Replay", () => {
  assert.equal(
    assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co"),
    "https://pwfftcsjyeibxxqhwysw.supabase.co",
  );
  assert.throws(
    () => assertReplayUrl("https://eouwtuusnsuxaejsxknf.supabase.co"),
    /limitée à Replay/,
  );
  assert.equal(PHARMACY_ID, "1a4f1ce5-cccf-477e-9a5b-474c8c9fc713");
  assert.match(PRODUCT_NAME, /NAXA E2E/);
});

test("le parcours browser vérifie le masquage Marketplace et l'ordre décision → vente → remboursement", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(path.join(__dirname, "e2e/verify-credit-pos-browser.cjs"), "utf8");
  assert.match(source, /visible_recherche !== false/);
  assert.match(source, /Dépassement du plafond/);
  assert.match(source, /Approuver le crédit comptoir/);
  assert.match(source, /Finaliser la vente à crédit/);
  assert.match(source, /client_credit_rembourser/);
  assert.match(source, /caisse_cloturer/);
  assert.match(source, /stockAfterSale/);
  assert.match(source, /sessionClosed/);
});

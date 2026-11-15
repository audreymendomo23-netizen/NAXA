"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { assertReplayUrl, PHARMACY_ID, PRODUCT } = require("./e2e/provision-replay-credit-pharmacy-safe.cjs");

test("la fixture crédit est épinglée à Replay et à la pharmacie masquée", () => {
  assert.equal(assertReplayUrl("https://pwfftcsjyeibxxqhwysw.supabase.co"), "https://pwfftcsjyeibxxqhwysw.supabase.co");
  assert.throws(() => assertReplayUrl("https://eouwtuusnsuxaejsxknf.supabase.co"), /strictement limitée à Replay/);
  assert.equal(PHARMACY_ID, "1a4f1ce5-cccf-477e-9a5b-474c8c9fc713");
  assert.match(PRODUCT.nom, /NAXA E2E/);
});

test("la fixture utilise les RPC officielles et refuse une pharmacie visible au public", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(path.join(__dirname, "e2e/provision-replay-credit-pharmacy-safe.cjs"), "utf8");
  assert.match(source, /visible_recherche !== false/);
  assert.match(source, /naxa_provision_caisse/);
  assert.match(source, /pharmacie_produit_declarer_et_reference_initialiser/);
  assert.match(source, /gestionnaire_stock_quantite_ajuster/);
  assert.doesNotMatch(source, /INSERT INTO public\.(stocks|produits)/i);
});

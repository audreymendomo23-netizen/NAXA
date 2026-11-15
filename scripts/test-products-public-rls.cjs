"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261115200000_pharmacy_owned_marketplace_product_publication.sql"),
  "utf8"
).toLowerCase();
const declaration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261115201000_pharmacy_product_declare_and_stock_reference.sql"),
  "utf8"
).toLowerCase();

test("anonymous product visibility follows a live pharmacy offer, not NAXA fiche validation", () => {
  assert.match(migration, /create policy produits_public_live_offer_read[\s\S]*?to anon[\s\S]*?marketplace_produit_visible/);
  assert.match(migration, /create or replace function public\.marketplace_produit_visible/);
  assert.match(migration, /ph\.actif is true/);
  assert.match(migration, /ph\.visible_recherche is true/);
  assert.match(migration, /ph\.est_demo is false/);
  assert.match(migration, /offer\.quantite>0/);
  assert.doesNotMatch(migration, /p\.fiche_validee is true/);
});

test("pharmacy declarations keep their declared content and record the declaring user and pharmacy", () => {
  assert.match(migration, /new\.created_by := auth\.uid\(\)/);
  assert.match(migration, /new\.created_by_pharmacie_id := public\.my_pharmacie\(\)/);
  assert.match(migration, /new\.source_fiche := 'declaration_pharmacie'/);
  assert.match(migration, /new\.fiche_validee := false/);
  assert.doesNotMatch(migration, /new\.description := null/);
  assert.doesNotMatch(migration, /new\.indications := null/);
  assert.doesNotMatch(migration, /new\.synonymes := '\{\}'/);
});

test("a pharmacy edits only its own declaration and does not receive NAXA validation controls", () => {
  assert.match(migration, /create policy produits_write[\s\S]*?created_by_pharmacie_id/);
  assert.match(migration, /create policy produits_update[\s\S]*?created_by_pharmacie_id/);
  assert.match(migration, /with check[\s\S]*?created_by_pharmacie_id/);
  assert.match(migration, /fiche_validee is not true/);
  assert.doesNotMatch(migration, /fiche_validee is true/);
});

test("the Marketplace offer and search engines no longer gate products on fiche_validee", () => {
  assert.match(migration, /private\.marketplace_offre_stock_disponible_guarded/);
  assert.match(migration, /private\.search_pharmacies\(/);
  assert.match(migration, /private\.search_pharmacies_bulk\(/);
  assert.match(migration, /position\('fiche_validee' in v_definition\)>0/);
  assert.match(migration, /v_definition := replace\(v_definition/);
});

test("the pharmacy declaration RPC is authenticated, pharmacy-scoped and initializes zero stock", () => {
  assert.match(declaration, /auth\.uid\(\)/);
  assert.match(declaration, /public\.my_pharmacie\(\)/);
  assert.match(declaration, /private\.naxa_business_function/);
  assert.match(declaration, /public\.gestionnaire_stock_reference_initialiser/);
  assert.match(declaration, /revoke all[\s\S]*?from public,anon/);
  assert.match(declaration, /to authenticated,service_role/);
});

test("the Marketplace remains protected by stock freshness, reservation and lot rules", () => {
  assert.match(migration, /private\.marketplace_stock_last_quantity_update/);
  assert.match(migration, /interval '48 hours'/);
  assert.match(migration, /public\.stocks_lots/);
  assert.match(migration, /l\.bloque/);
  assert.match(migration, /l\.date_peremption/);
  assert.match(migration, /public\.reservation_items/);
  assert.match(migration, /r\.expires_at>now\(\)/);
});

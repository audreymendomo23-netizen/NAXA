"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261115204000_promoter_product_read_policy_uses_public_guard.sql"),
  "utf8"
).toLowerCase();

test("promoter product reads call the public self-scoped validity wrapper", () => {
  assert.match(migration, /create policy produits_authenticated_live_offer_read/);
  assert.match(migration, /public\.naxa_promoteur_valide\(auth\.uid\(\)\)/);
  assert.doesNotMatch(migration, /private\.naxa_promoteur_valide/);
});

test("the policy keeps product visibility, Admin and pharmacy workspace scopes", () => {
  assert.match(migration, /public\.marketplace_produit_visible\(id\)/);
  assert.match(migration, /public\.is_admin\(\)/);
  assert.match(migration, /private\.naxa_business_function\(auth\.uid\(\)\)/);
  assert.match(migration, /public\.my_pharmacie\(\)/);
});

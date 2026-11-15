"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261115190000_secure_public_read_of_unvalidated_products.sql"),
  "utf8"
).toLowerCase();

test("public anonymous product reads are restricted to validated records", () => {
  assert.match(migration, /drop policy if exists produits_read/);
  assert.match(migration, /create policy produits_public_validated_read/);
  assert.match(migration, /for select\s+to anon\s+using \(fiche_validee is true\)/);
  assert.doesNotMatch(migration, /to anon[\s\S]*?using \(true\)/);
});

test("authenticated internal catalog access requires an active pharmacy context or Admin", () => {
  assert.match(migration, /create policy produits_authenticated_catalog_read/);
  assert.match(migration, /to authenticated/);
  assert.match(migration, /public\.is_admin\(\)/);
  assert.match(migration, /private\.naxa_business_function\(auth\.uid\(\)\)/);
  assert.match(migration, /public\.my_pharmacie\(\)/);
  assert.doesNotMatch(migration, /'livreur'/);
});

test("a pharmacy INSERT cannot self-publish an unvalidated product", () => {
  assert.match(migration, /drop policy if exists produits_write/);
  assert.match(migration, /create policy produits_write[\s\S]*?for insert\s+to authenticated/);
  assert.match(migration, /fiche_validee is not true/);
  assert.match(migration, /public\.is_admin\(\)/);
});

test("the correction does not modify UPDATE/DELETE policies or stock records", () => {
  assert.doesNotMatch(migration, /for update|for delete|public\.stocks|public\.stocks_lots/i);
  assert.doesNotMatch(migration, /grant\s+|revoke\s+/i);
});

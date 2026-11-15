"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261115203000_allow_pharmacy_declared_products_source.sql"),
  "utf8"
).toLowerCase();
const publication = fs.readFileSync(
  path.join(root, "supabase/migrations/20261115200000_pharmacy_owned_marketplace_product_publication.sql"),
  "utf8"
).toLowerCase();
const declaration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261115201000_pharmacy_product_declare_and_stock_reference.sql"),
  "utf8"
).toLowerCase();

test("the products source constraint explicitly accepts pharmacy declarations", () => {
  assert.match(migration, /drop constraint if exists produits_source_fiche_check/);
  assert.match(migration, /add constraint produits_source_fiche_check/);
  assert.match(migration, /'declaration_pharmacie'/);
  assert.match(migration, /not valid/);
});

test("the pharmacy declaration trigger source agrees with the database check constraint", () => {
  assert.match(publication, /new\.source_fiche := 'declaration_pharmacie'/);
  assert.match(migration, /'declaration_pharmacie'/);
});

test("the declaration RPC still creates only a zero-quantity stock reference", () => {
  assert.match(declaration, /public\.gestionnaire_stock_reference_initialiser/);
  assert.match(declaration, /'declaration_pharmacie',false/);
  assert.doesNotMatch(migration, /insert into public\.(produits|stocks)|update public\.(produits|stocks)/);
});

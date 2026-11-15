"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261115191000_guard_marketplace_offer_internal_rpc.sql"),
  "utf8"
).toLowerCase();

test("the public offer endpoint is an explicitly hardened SECURITY DEFINER wrapper", () => {
  assert.match(migration, /create or replace function public\.marketplace_offre_stock_disponible/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /private\.marketplace_offre_stock_disponible_guarded/);
});

test("the internal offer implementation is not executable by API roles", () => {
  assert.match(migration, /revoke all on function private\.marketplace_offre_stock_disponible_guarded/);
  assert.match(migration, /from public, anon, authenticated/);
});

test("the filtered public endpoint remains available to intended marketplace callers", () => {
  assert.match(migration, /grant execute on function public\.marketplace_offre_stock_disponible/);
  assert.match(migration, /to anon, authenticated, service_role/);
});

test("no stock, lot, payment or product validation data is written", () => {
  assert.doesNotMatch(migration, /insert into|update public\.(stocks|stocks_lots|produits)|delete from/i);
});

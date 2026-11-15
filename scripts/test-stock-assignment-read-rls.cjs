"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261115183000_allow_active_stock_assignments_to_read_pharmacy_stock.sql"),
  "utf8"
).toLowerCase();

test("only currently assigned Stock/Magasinier profiles receive stock SELECT", () => {
  assert.match(migration, /create policy stocks_read_active_stock_assignment/);
  assert.match(migration, /for select/);
  assert.match(migration, /to authenticated/);
  assert.match(migration, /naxa_has_active_professional_assignment/);
  assert.match(migration, /gestionnaire_stock/);
  assert.match(migration, /magasinier/);
});

test("the policy does not add direct stock write operations or anonymous access", () => {
  assert.doesNotMatch(migration, /for insert|for update|for delete|to anon/);
  assert.doesNotMatch(migration, /grant .*stocks/);
});

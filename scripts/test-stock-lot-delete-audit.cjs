"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261115210000_fix_stock_lot_delete_audit_fk.sql"),
  "utf8"
);
const sqlTest = fs.readFileSync(
  path.join(root, "supabase/tests/20261115210000_fix_stock_lot_delete_audit_fk.sql"),
  "utf8"
);

test("la suppression d'un lot ne laisse plus un UUID orphelin dans le journal stock", () => {
  assert.ok(migration.includes("v_lot:=null"));
  assert.ok(migration.includes("v_numero_lot:=old.numero_lot"));
  assert.ok(migration.includes("v_event:='suppression'"));
  assert.ok(migration.includes("private.journaliser_mouvement_stock_gestionnaire"));
});

test("le contrat runtime vérifie la FK nullable, l'audit conservé et le rollback", () => {
  assert.ok(sqlTest.includes("stock_manager_movement_journal_lot_id_fkey"));
  assert.ok(sqlTest.includes("ON DELETE SET NULL"));
  assert.ok(sqlTest.includes("and j.lot_id is null"));
  assert.ok(sqlTest.includes("j.numero_lot=v_lot.numero_lot"));
  assert.ok(sqlTest.includes("delete from public.stocks_lots"));
  assert.ok(sqlTest.includes("rollback;"));
});

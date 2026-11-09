const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261109060000_fournisseurs_rls_policy_consolidation.sql"),
  "utf8"
);
const staffMigration = fs.readFileSync(
  path.join(root, "supabase/migration_197_fournisseurs_role_security.sql"),
  "utf8"
);
const regression = fs.readFileSync(
  path.join(root, "supabase/tests/20261109060000_fournisseurs_rls_policy_consolidation.sql"),
  "utf8"
);

test("supplier RLS consolidation removes every legacy permissive scope policy", () => {
  for (const name of [
    "fournisseurs_scope",
    "fournisseurs_read_scope",
    "fournisseurs_insert_scope",
    "fournisseurs_update_scope",
    "fournisseurs_delete_scope",
  ]) {
    assert.match(migration, new RegExp("DROP POLICY IF EXISTS " + name + "\\b", "i"));
  }
  assert.doesNotMatch(migration, /CREATE\\s+POLICY/i);
  assert.doesNotMatch(migration, /DELETE\\s+FROM|UPDATE\\s+public\\.fournisseurs|INSERT\\s+INTO/i);
});

test("the intended active ERP staff allow-list remains the only write contract", () => {
  for (const name of [
    "fournisseurs_read_staff",
    "fournisseurs_insert_staff",
    "fournisseurs_update_staff",
    "fournisseurs_delete_staff",
  ]) {
    assert.match(staffMigration, new RegExp("CREATE POLICY " + name + "\\b", "i"));
  }
  assert.match(staffMigration, /p\\.actif\\s*=\\s*true/i);
  for (const role of ["promoteur", "pharmacien", "pharmacien_assistant", "responsable", "gestionnaire_stock", "magasinier"]) {
    assert.match(staffMigration, new RegExp(role));
  }
});

test("SQL regression covers unauthorized read, insert, update and delete and rolls back", () => {
  assert.match(regression, /SET LOCAL ROLE authenticated/i);
  assert.match(regression, /request\\.jwt\\.claim\\.sub/i);
  for (const operation of ["SELECT count", "UPDATE public\\.fournisseurs", "DELETE FROM public\\.fournisseurs", "INSERT INTO public\\.fournisseurs"]) {
    assert.match(regression, new RegExp(operation, "i"));
  }
  assert.match(regression, /EXCEPTION WHEN insufficient_privilege/i);
  assert.match(regression, /ROLLBACK\\s*;/i);
});

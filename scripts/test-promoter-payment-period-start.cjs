const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261102115000_promoteur_subscription_period_starts_on_confirmation.sql"),
  "utf8",
).toLowerCase();
const source = fs.readFileSync(
  path.join(root, "supabase/migrations/20261027090000_safe_promoter_payment_reactivation_scope.sql"),
  "utf8",
).toLowerCase();
const sqlTest = fs.readFileSync(
  path.join(root, "supabase/tests/20261102115000_promoteur_subscription_period_starts_on_confirmation.sql"),
  "utf8",
).toLowerCase();

test("la période mensuelle démarre à la date réelle de confirmation du paiement", () => {
  assert.match(migration, /v_debut := \(now\(\) at time zone 'africa\/douala'\)::date/);
  assert.doesNotMatch(migration, /greatest\(\s*\(now\(\) at time zone 'africa\/douala'\)::date,\s*a\.echeance\s*\+\s*1/);
  assert.match(migration, /v_fin := \(v_debut \+ interval '1 month' - interval '1 day'\)::date/);
  assert.match(migration, /for update/);
  assert.match(migration, /r\.statut='confirme'/);
  assert.match(migration, /r\.statut<>'en_attente'/);
  assert.match(migration, /grant execute on function public\.admin_confirmer_reglement_promoteur\(uuid,uuid\) to service_role/);
  assert.match(sqlTest, /les acl de confirmation doivent rester service_role uniquement/);
  assert.match(source, /greatest\(\(now\(\) at time zone 'africa\/douala'\)::date, a\.echeance \+ 1\)/);
});

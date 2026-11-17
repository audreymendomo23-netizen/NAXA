const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (relativePath) => fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
const ui = read("src/app/pharmacie/caisse/page.tsx");
const migration = read("supabase/migrations/20261117173913_caisse_credit_repayment_multichannel_atomic.sql");
const accountMigration = read("supabase/migrations/20261117180000_caisse_credit_treasury_account_create_atomic.sql");
const e2e = read("supabase/tests/302_caisse_credit_repayment_multichannel_e2e.sql");

for (const channel of ["especes", "orange_money", "mtn_momo"]) {
  assert.ok(ui.includes(channel), `UI must expose ${channel}`);
  assert.ok(migration.includes(channel), `SQL contract must support ${channel}`);
  assert.ok(e2e.includes(channel), `Replay E2E must cover ${channel}`);
}

assert.match(ui, /p_idempotency_key:\s*idempotencyKey/);
assert.match(ui, /const idempotencyKey = pending\?\.idempotencyKey \?\? refundIdempotencyKey \?\? crypto\.randomUUID\(\)/);
assert.equal((ui.match(/setRefundIdempotencyKey\(null\);/g) || []).length, 2,
  "The idempotency key is cleared only after success or a confirmed server rejection");
assert.match(ui, /localStorage\.setItem\(refundPendingStorageKey/);
assert.match(ui, /localStorage\.removeItem\(refundPendingStorageKey/);
assert.match(ui, /setRefundRequestUncertain\(true\)/);
assert.match(ui, /disabled=\{busy \|\| refundRequestUncertain/);
assert.match(ui, /knownServerRejection/);
assert.match(ui, /Réessayer la même demande/);
assert.match(ui, /p_verification_beneficiaire:\s*refundVerifyBeneficiary/);
assert.match(ui, /p_verification_montant:\s*refundVerifyAmount/);
assert.match(ui, /p_confirmation_client_vue:\s*refundClientConfirmed/);
assert.match(ui, /caisse_credit_tresorerie_comptes_lister/);
assert.match(ui, /caisse_credit_tresorerie_compte_creer/);
assert.match(ui, /id="refund-ticket"/);
assert.match(ui, /Imprimer le reçu/);

// Sale settlement remains guarded separately; this change does not claim operator confirmation.
assert.match(ui, /Paiements électroniques indisponibles/);

assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /create unique index if not exists client_credit_operations_idempotency_uidx/);
assert.match(migration, /create unique index if not exists tresorerie_mouvements_credit_refund_source_uidx/);
assert.match(migration, /insert into public\.tresorerie_mouvements/);
assert.match(migration, /'credit_remboursement'.*'comptoir'/s);
assert.match(accountMigration, /caisse_credit_tresorerie_compte_creer/);
assert.match(accountMigration, /pg_advisory_xact_lock/);

assert.match(e2e, /ROLLBACK;/i);
assert.match(e2e, /compta_evenement/);
assert.match(e2e, /clé idempotence réutilisée avec montant différent/i);
assert.match(e2e, /preuve complète/i);

process.stdout.write("OK — contrat Caisse remboursement crédit : 3 canaux, idempotence, preuve mobile, trésorerie, reçu et recette Replay.\n");

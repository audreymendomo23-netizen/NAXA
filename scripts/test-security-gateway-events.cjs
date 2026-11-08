const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase/migration_309_security_gateway_events.sql"), "utf8");
const route = fs.readFileSync(path.join(root, "src/app/api/security/gateway/events/route.ts"), "utf8");

test("ingestion : passerelle signée, installation pilote validée et RPC atomique", () => {
  assert.ok(route.includes("authenticateSignedSecurityGateway"));
  assert.ok(route.includes('auth.installation.status !== "pilot_active"'));
  assert.ok(route.includes('auth.installation.legal_review_status !== "approved"'));
  assert.ok(route.includes("naxa_security_ingest_gateway_event"));
  assert.ok(route.includes("sourceFingerprint"));
  assert.ok(route.includes("metadataKeys"));
  assert.doesNotMatch(route, /\.from\("naxa_security_events"\)\.insert/);
});

test("SQL : index unique par passerelle, gravité serveur et audit", () => {
  assert.ok(migration.includes("naxa_security_events_gateway_fingerprint_uidx"));
  assert.ok(migration.includes("on conflict (gateway_id, source_fingerprint)"));
  assert.ok(migration.includes("v_severity := case"));
  assert.ok(migration.includes("naxa_security_access_audit"));
  assert.ok(migration.includes("security invoker"));
  assert.ok(migration.includes("set search_path = ''"));
  assert.doesNotMatch(migration, /grant execute[^;]+to authenticated/i);
});

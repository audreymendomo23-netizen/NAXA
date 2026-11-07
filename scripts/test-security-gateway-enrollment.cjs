const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const migration = read("supabase/migration_303_security_gateway_enrollment.sql");
const provision = read("src/app/api/security/gateway/provision/route.ts");
const enroll = read("src/app/api/security/gateway/enroll/route.ts");
const heartbeat = read("src/app/api/security/gateway/heartbeat/route.ts");
const agent = read("services/security-gateway/agent.cjs");
const ui = read("src/components/pharmacie/PromoteurGatewayProvisioning.tsx");
const dashboard = read("src/components/pharmacie/PromoteurSecuriteIntelligente.tsx");

test("codes de jumelage : hash SHA-256, usage unique, expiration 15 minutes et périmètre Promoteur", () => {
  assert.match(provision, /randomBytes\(32\)/);
  assert.match(provision, /createHash\("sha256"\)/);
  assert.match(provision, /15 \* 60 \* 1000/);
  assert.match(provision, /access\.activeLinkIds\.has/);
  assert.match(provision, /access\.shouldShowAccessStatus/);
  assert.match(migration, /one_pending_enrollment/);
});

test("enrôlement : clé Ed25519, consommation atomique et révocation de la clé précédente", () => {
  assert.match(enroll, /asymmetricKeyType !== "ed25519"/);
  assert.match(enroll, /consumed_at/);
  assert.match(enroll, /revoked_at/);
  assert.match(enroll, /public_key_fingerprint/);
  assert.match(migration, /one_active_key/);
});

test("heartbeat : signature du corps, fenêtre temporelle et anti-rejeu", () => {
  assert.match(heartbeat, /createPublicKey/);
  assert.match(heartbeat, /verify\(null/);
  assert.match(heartbeat, /Math\.abs/);
  assert.match(heartbeat, /naxa_security_gateway_request_nonces/);
  assert.match(heartbeat, /Rejeu de requête détecté/);
  assert.match(heartbeat, /capabilities: \["heartbeat"\]/);
});

test("agent local : aucune dépendance tierce, clé privée hors serveur et aucun port entrant", () => {
  assert.match(agent, /generateKeyPairSync\("ed25519"\)/);
  assert.match(agent, /mode: 0o600/);
  assert.match(agent, /https:/);
  assert.match(agent, /api\/security\/gateway\/heartbeat/);
  assert.doesNotMatch(agent, /createServer\(|listen\(/);
});

test("interface Promoteur : code à usage unique, pas de journalisation navigateur", () => {
  assert.match(ui, /Créer un code de jumelage/);
  assert.match(ui, /one-time|usage unique|une seule fois/i);
  assert.match(dashboard, /PromoteurGatewayProvisioning/);
  assert.doesNotMatch(ui, /console\.(log|info|debug).*token/i);
});

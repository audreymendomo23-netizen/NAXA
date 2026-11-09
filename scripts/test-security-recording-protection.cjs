const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const gatewayRoute = fs.readFileSync(path.join(root, "src/app/api/security/gateway/recording-protection/route.ts"), "utf8");
const promoterRoute = fs.readFileSync(path.join(root, "src/app/api/security/recording-segments/protection/route.ts"), "utf8");
const timelineRoute = fs.readFileSync(path.join(root, "src/app/api/security/recording-segments/route.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261109030000_security_recording_protection.sql"), "utf8");
const sqlTest = fs.readFileSync(path.join(root, "supabase/tests/312_security_recording_protection.sql"), "utf8");
const agent = fs.readFileSync(path.join(root, "services/security-gateway/agent.cjs"), "utf8");
const recorder = fs.readFileSync(path.join(root, "services/security-gateway/recording.cjs"), "utf8");

test("lot 13 : protection de preuve transactionnelle et accès RPC backend uniquement", () => {
  assert.match(migration, /security invoker/i);
  assert.match(migration, /set search_path = ''/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /naxa_security_access_audit/i);
  assert.match(migration, /revoke all on function[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function[\s\S]*to service_role/i);
  assert.ok(sqlTest.includes("protection_rpc_backend_only"));
});

test("lot 13 : Promoteur justifié, périmètre actif, aucun chemin local exposé", () => {
  assert.ok(promoterRoute.includes("loadPromoteurAccess"));
  assert.ok(promoterRoute.includes("activeLinkIds.has(segment.pharmacie_id)"));
  assert.ok(promoterRoute.includes("naxa_security_set_recording_protection"));
  assert.ok(promoterRoute.includes("reason.length < 8"));
  assert.doesNotMatch(promoterRoute, /storage_path|signed_url|download_url/i);
});

test("lot 13 : la passerelle ne reçoit que sa liste complète de noms protégés", () => {
  assert.ok(gatewayRoute.includes("authenticateSignedSecurityGateway"));
  assert.ok(gatewayRoute.includes("MAX_PROTECTED_ROWS"));
  assert.ok(gatewayRoute.includes("complete: false"));
  assert.ok(gatewayRoute.includes('eq("gateway_id", auth.gateway.id)'));
  assert.ok(gatewayRoute.includes('eq("status", "protected")'));
  assert.ok(gatewayRoute.includes("protectedByCamera"));
  assert.ok(agent.includes("/api/security/gateway/recording-protection"));
  assert.ok(agent.includes("PROTECTED_RECORDING_SYNC_INCOMPLETE"));
  assert.ok(recorder.includes("purge suspendue par sécurité"));
});

test("lot 13 : timeline auditée, bornée et sans exposition des chemins", () => {
  assert.ok(timelineRoute.includes("recording_segment_view"));
  assert.ok(timelineRoute.includes("MAX_WINDOW_DAYS = 31"));
  assert.ok(timelineRoute.includes("MAX_ROWS = 100"));
  assert.ok(timelineRoute.includes("naxa_security_access_audit"));
  assert.doesNotMatch(timelineRoute, /storage_path|public_url|signed_url|download_url/i);
});

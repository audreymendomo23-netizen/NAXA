const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const route = fs.readFileSync(
  path.join(root, "src/app/api/security/gateway/recording-segments/route.ts"),
  "utf8",
);
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261109020000_security_recording_segment_sync.sql"),
  "utf8",
);
const sqlTest = fs.readFileSync(
  path.join(root, "supabase/tests/311_security_recording_segment_sync.sql"),
  "utf8",
);
const agent = fs.readFileSync(
  path.join(root, "services/security-gateway/agent.cjs"),
  "utf8",
);

test("lot 13 : synchronisation HTTPS signée et bornée à dix segments", () => {
  assert.ok(route.includes("authenticateSignedSecurityGateway"));
  assert.ok(route.includes("Buffer.byteLength(rawBody, \"utf8\") > 8192"));
  assert.ok(route.includes("maximumBatch = 10"));
  assert.ok(route.includes("pilot_active"));
  assert.ok(route.includes("legal_review_status !== \"approved\""));
  assert.ok(route.includes("privacy_notice_status !== \"approved\""));
  assert.ok(route.includes("naxa_security_sync_recording_segments"));
});

test("lot 13 : les caméras doivent appartenir à la même pharmacie et passerelle", () => {
  assert.ok(route.includes('.eq("pharmacie_id", auth.gateway.pharmacie_id)'));
  assert.ok(route.includes('.eq("gateway_id", auth.gateway.id)'));
  assert.ok(route.includes('["disabled", "retired"]'));
  assert.ok(migration.includes("c.pharmacie_id = p_pharmacie_id"));
  assert.ok(migration.includes("c.gateway_id = p_gateway_id"));
});

test("lot 13 : seules les métadonnées vidéo MP4 sont acceptées, audio interdit", () => {
  for (const fragment of [
    "durationSeconds",
    "codecPattern",
    's.containerFormat !== "mp4"',
    's.audioEnabled !== false',
    "sizeBytes",
    "sha256",
    "retentionUntil",
    "storagePath",
  ]) assert.ok(route.includes(fragment), "Validation absente : " + fragment);
  assert.ok(migration.includes("s.audio_enabled is distinct from false"));
  assert.ok(migration.includes("s.container_format <> 'mp4'"));
  assert.ok(migration.includes("s.sha256 !~"));
  assert.ok(migration.includes("s.storage_path !~"));
  assert.doesNotMatch(route, /public_url|download_url|signed_url|rtsp:\/\//i);
});

test("lot 13 : idempotence, collision hash et audit transactionnel", () => {
  assert.ok(migration.toLowerCase().includes("on conflict (camera_id, storage_path) do nothing"));
  assert.ok(migration.toLowerCase().includes("count(distinct s.sha256) > 1"));
  assert.ok(migration.includes("recording_segment_sync"));
  assert.ok(migration.includes("naxa_security_access_audit"));
  assert.ok(sqlTest.includes("sync_rpc_backend_only"));
  assert.ok(sqlTest.includes("sync_rpc_idempotent_conflict_checked_and_audited"));
});

test("lot 13 : file locale préservée, endpoint raccordé dans l'agent", () => {
  assert.ok(agent.includes("/api/security/gateway/recording-segments"));
  assert.ok(agent.includes("recording-indexer"));
});

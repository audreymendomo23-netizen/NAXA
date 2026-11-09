const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase/migration_308_security_stream_publisher.sql"), "utf8");
const tokenRoute = fs.readFileSync(path.join(root, "src/app/api/security/gateway/stream-publish-token/route.ts"), "utf8");
const healthRoute = fs.readFileSync(path.join(root, "src/app/api/security/gateway/stream-health/route.ts"), "utf8");
const authRoute = fs.readFileSync(path.join(root, "src/app/api/security/mediamtx/auth/route.ts"), "utf8");
const agent = fs.readFileSync(path.join(root, "services/security-gateway/agent.cjs"), "utf8");
const helper = fs.readFileSync(path.join(root, "src/lib/security/gateway-request.ts"), "utf8");
const proxy = fs.readFileSync(path.join(root, "services/security-gateway/rtsp-publish-proxy.cjs"), "utf8");

test("publisher tickets : hash, RLS et RPC réservés au serveur", () => {
  for (const item of [
    "token_sha256 text not null unique", "force row level security",
    "revoke all on public.naxa_security_stream_publish_tickets from public, anon, authenticated",
    "grant all on public.naxa_security_stream_publish_tickets to service_role",
    "security invoker", "set search_path = ''",
  ]) assert.ok(migration.toLowerCase().includes(item.toLowerCase()), item);
  assert.doesNotMatch(migration, /token\s+text|rtsp_url|camera_password/i);
});

test("ticket publisher : signature Ed25519, anti-rejeu, scope gateway et live_view", () => {
  assert.ok(tokenRoute.includes("authenticateSignedSecurityGateway"));
  assert.ok(tokenRoute.includes('.eq("gateway_id", auth.gateway.id)'));
  assert.ok(tokenRoute.includes('.eq("pharmacie_id", auth.gateway.pharmacie_id)'));
  assert.ok(tokenRoute.includes('connection_status !== "connected"'));
  assert.ok(tokenRoute.includes('includes("live_view")'));
  assert.ok(tokenRoute.includes("naxa_security_issue_stream_publish_ticket"));
  assert.ok(tokenRoute.includes("NAXA_MEDIAMTX_RTSPS_URL"));
  assert.ok(tokenRoute.includes("randomBytes(32)"));
  assert.ok(helper.includes("verify(null"));
  assert.ok(helper.includes("naxa_security_gateway_request_nonces"));
});

test("statut caméra : online seulement après une frame positive", () => {
  assert.ok(healthRoute.includes('["online", "offline"]'));
  assert.ok(healthRoute.includes("Number(frameCount) < 1"));
  assert.ok(healthRoute.includes("authenticateSignedSecurityGateway"));
  assert.ok(healthRoute.includes("naxa_security_report_stream_health"));
});

test("MediaMTX : publish limité à RTSP et lecture WebRTC conservée", () => {
  assert.ok(authRoute.includes('body.action === "publish" && body.protocol === "rtsp"'));
  assert.ok(authRoute.includes("naxa_security_stream_publish_tickets"));
  assert.ok(authRoute.includes("body.password"));
  assert.ok(authRoute.includes('body.action !== "read" || body.protocol !== "webrtc"'));
});

test("agent : URI caméra chiffrée, FFmpeg sans shell et statut signé", () => {
  for (const item of [
    "aes-256-gcm", "camera-streams.enc", "validateLocalRtspSource",
    "spawn(process.env.NAXA_FFMPEG_BIN || \"ffmpeg\", args", "/api/security/gateway/stream-publish-token",
    "/api/security/gateway/stream-health", "shell: false", 'redirect: "error"',
  ]) assert.ok(agent.includes(item), item);
  assert.ok(agent.includes("createPrivateRtspManifest"));
  assert.ok(agent.includes("createRtspPublishProxy"));
  assert.ok(agent.includes("publishUrl: localDestination.url"));
  assert.ok(proxy.includes('server.listen(0, "127.0.0.1"'));
  assert.ok(proxy.includes("rejectUnauthorized: true"));
  assert.ok(proxy.includes("Authorization: " + "authorization"));
  assert.doesNotMatch(agent, /publishUrl: ticket\\.publishUrl/);
  assert.doesNotMatch(agent, /buildPublishFfmpegArgs\\(camera\\.sourceUrl/);
});

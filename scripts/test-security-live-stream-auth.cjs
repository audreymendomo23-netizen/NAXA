const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase/migration_307_security_live_stream_sessions.sql"), "utf8");
const issueRoute = fs.readFileSync(path.join(root, "src/app/api/security/cameras/live-session/route.ts"), "utf8");
const authRoute = fs.readFileSync(path.join(root, "src/app/api/security/mediamtx/auth/route.ts"), "utf8");
const player = fs.readFileSync(path.join(root, "src/components/pharmacie/SecurityWhepPlayer.tsx"), "utf8");
const doc = fs.readFileSync(path.join(root, "docs/security/PHASE8_ACCES_VIDEO_WEBRTC.md"), "utf8");

test("sessions live : hash seulement, expiration courte, RLS forcée et aucune lecture directe navigateur", () => {
  assert.match(migration, /token_sha256 text not null unique/);
  assert.match(migration, /expires_at > issued_at/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /force row level security/i);
  assert.match(migration, /revoke all on public\\.naxa_security_live_sessions from public, anon, authenticated/i);
  assert.match(migration, /grant all on public\\.naxa_security_live_sessions to service_role/i);
  assert.doesNotMatch(migration, /token\\s+text|rtsp_url|camera_password/i);
});

test("émission : Promoteur actif, réseau autorisé, installation validée, passerelle fraîche et capacité live requise", () => {
  for (const check of [
    /loadPromoteurAccess/,
    /activeLinkIds\\.has\\(camera\\.pharmacie_id\\)/,
    /camera\\.status !== "online"/,
    /gateway\\.tunnel_status !== "connected"/,
    /GATEWAY_FRESHNESS_MS/,
    /installation\\.status !== "pilot_active"/,
    /legal_review_status !== "approved"/,
    /privacy_notice_status !== "approved"/,
    /capabilities\\.includes\\("live_view"\\)/,
    /connection_status !== "connected"/,
  ]) assert.match(issueRoute, check);
  assert.match(issueRoute, /randomBytes\\(32\\)/);
  assert.match(issueRoute, /createHash\\("sha256"\\)/);
  assert.match(issueRoute, /naxa_security_issue_live_session/);
  assert.match(issueRoute, /NAXA_MEDIAMTX_PUBLIC_URL/);
  assert.doesNotMatch(issueRoute, /rtsp:\/\/|camera_password|auth_secret_reference/);
});

test("auth MediaMTX : refuse tout sauf read/webrtc, ticket lié au chemin, recontrôle l'état à chaque handshake", () => {
  assert.match(authRoute, /body\\.action !== "read"/);
  assert.match(authRoute, /body\\.protocol !== "webrtc"/);
  assert.match(authRoute, /\\.eq\\("token_sha256", tokenSha256\\)/);
  assert.match(authRoute, /\\.eq\\("media_path", path\\)/);
  assert.match(authRoute, /\\.gt\\("expires_at"/);
  assert.match(authRoute, /installation\\?\\.status === "pilot_active"/);
  assert.match(authRoute, /profile\\?\\.role === "promoteur"/);
  assert.match(authRoute, /capabilities\\.includes\\("live_view"\\)/);
  assert.doesNotMatch(authRoute, /console\\.(log|error).*token/i);
});

test("lecteur WebRTC : ticket serveur, WHEP avec Bearer, nettoyage et renouvellement", () => {
  assert.match(player, /api\\/security\\/cameras\\/live-session/);
  assert.match(player, /Authorization: session\\.authorization/);
  assert.match(player, /application\\/sdp/);
  assert.match(player, /setRemoteDescription/);
  assert.match(player, /method: "DELETE"/);
  assert.match(player, /refreshAfterSeconds/);
  assert.doesNotMatch(player, /rtsp:\/\/|camera_password/);
});

test("documentation : MediaMTX HTTP auth, WHEP, configuration HTTPS et limites matériel", () => {
  assert.match(doc, /authMethod: http/);
  assert.match(doc, /authHTTPAddress/);
  assert.match(doc, /WHEP/);
  assert.match(doc, /NAXA_MEDIAMTX_PUBLIC_URL/);
  assert.match(doc, /ingestion passerelle/);
  assert.match(doc, /aucune caméra physique/);
});

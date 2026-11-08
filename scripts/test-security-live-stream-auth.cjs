const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase/migration_307_security_live_stream_sessions.sql"), "utf8");
const issueRoute = fs.readFileSync(path.join(root, "src/app/api/security/cameras/live-session/route.ts"), "utf8");
const revokeRoute = fs.readFileSync(path.join(root, "src/app/api/security/cameras/live-session/revoke/route.ts"), "utf8");
const authRoute = fs.readFileSync(path.join(root, "src/app/api/security/mediamtx/auth/route.ts"), "utf8");
const player = fs.readFileSync(path.join(root, "src/components/pharmacie/SecurityWhepPlayer.tsx"), "utf8");
const doc = fs.readFileSync(path.join(root, "docs/security/PHASE8_ACCES_VIDEO_WEBRTC.md"), "utf8");

test("sessions live : hash seulement, expiration courte, RLS forcée et privilèges fermés au navigateur", () => {
  assert.ok(migration.includes("token_sha256 text not null unique"));
  assert.ok(migration.includes("alter table public.naxa_security_live_sessions enable row level security"));
  assert.ok(migration.includes("alter table public.naxa_security_live_sessions force row level security"));
  assert.ok(migration.includes("revoke all on public.naxa_security_live_sessions from public, anon, authenticated"));
  assert.ok(migration.includes("grant all on public.naxa_security_live_sessions to service_role"));
  assert.ok(migration.includes("p_token_sha256 is null or p_media_path is null"));
  assert.ok(migration.includes("camera.gateway_id = p_gateway_id"));
  assert.doesNotMatch(migration, /token\s+text|rtsp_url|camera_password/i);
});

test("émission : Promoteur actif, réseau autorisé, installation validée, passerelle fraîche et capacité live requise", () => {
  for (const fragment of [
    "loadPromoteurAccess",
    "activeLinkIds.has(camera.pharmacie_id)",
    'camera.status !== "online"',
    'gateway.tunnel_status !== "connected"',
    "GATEWAY_FRESHNESS_MS",
    'installation.status !== "pilot_active"',
    'legal_review_status !== "approved"',
    'privacy_notice_status !== "approved"',
    'capabilities.includes("live_view")',
    'connection_status !== "connected"',
  ]) assert.ok(issueRoute.includes(fragment), "Contrôle absent: " + fragment);
  assert.ok(issueRoute.includes("randomBytes(32)"));
  assert.ok(issueRoute.includes('createHash("sha256")'));
  assert.ok(issueRoute.includes("naxa_security_issue_live_session"));
  assert.ok(issueRoute.includes("NAXA_MEDIAMTX_PUBLIC_URL"));
  assert.doesNotMatch(issueRoute, /rtsp:\/\/|camera_password|auth_secret_reference/);
});

test("MediaMTX : uniquement read/webrtc, ticket lié au chemin et rattachement Promoteur encore actif", () => {
  for (const fragment of [
    'body.action !== "read"',
    'body.protocol !== "webrtc"',
    '.eq("token_sha256", tokenSha256)',
    '.eq("media_path", path)',
    '.gt("expires_at"',
    'installation?.status === "pilot_active"',
    'profile?.role === "promoteur"',
    'assignment?.pharmacie_id === session.pharmacie_id',
    'capabilities.includes("live_view")',
  ]) assert.ok(authRoute.includes(fragment), "Garde-fou absent: " + fragment);
  assert.doesNotMatch(authRoute, /console\.(log|error).*token/i);
});

test("révocation : session liée au compte propriétaire, rôle Promoteur et affectation active", () => {
  assert.ok(revokeRoute.includes('authorization.startsWith("Bearer ")'));
  assert.ok(revokeRoute.includes('.eq("user_id", access.profile.id)'));
  assert.ok(revokeRoute.includes("access.activeLinkIds.has(session.pharmacie_id)"));
  assert.ok(revokeRoute.includes('status: "revoked"'));
  assert.ok(revokeRoute.includes('status: "active"'));
});

test("lecteur WebRTC : ticket serveur, WHEP, fermeture, révocation et URL Location de même origine", () => {
  assert.ok(player.includes("/api/security/cameras/live-session"));
  assert.ok(player.includes("Authorization: session.authorization"));
  assert.ok(player.includes("application/sdp"));
  assert.ok(player.includes("setRemoteDescription"));
  assert.ok(player.includes('method: "DELETE"'));
  assert.ok(player.includes("/api/security/cameras/live-session/revoke"));
  assert.ok(player.includes("resolvedResource.origin"));
  assert.ok(player.includes("refreshAfterSeconds"));
  assert.doesNotMatch(player, /rtsp:\/\/|camera_password/);
});

test("documentation : MediaMTX HTTP auth, WHEP, configuration HTTPS et limites matériel", () => {
  for (const fragment of [
    "authMethod: http",
    "authHTTPAddress",
    "WHEP",
    "NAXA_MEDIAMTX_PUBLIC_URL",
    "ingestion sortante",
    "aucune caméra physique",
    "Location au navigateur",
  ]) assert.ok(doc.includes(fragment), "Documentation incomplète: " + fragment);
});

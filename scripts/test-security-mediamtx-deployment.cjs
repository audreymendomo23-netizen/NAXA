const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const base = path.join(__dirname, "..", "infra/security/mediamtx");
const config = fs.readFileSync(path.join(base, "mediamtx.yml"), "utf8");
const compose = fs.readFileSync(path.join(base, "docker-compose.yml"), "utf8");
const readme = fs.readFileSync(path.join(base, "README.md"), "utf8");

test("MediaMTX est versionné et servi uniquement sur transports TLS/WebRTC prévus", () => {
  assert.ok(compose.includes("bluenviron/mediamtx:1.21.3"));
  assert.ok(compose.includes("8322:8322/tcp"));
  assert.ok(compose.includes("8889:8889/tcp"));
  assert.ok(compose.includes("8189:8189/udp"));
  assert.ok(config.includes("rtspEncryption: strict"));
  assert.ok(config.includes("rtspsAddress: :8322"));
  assert.ok(config.includes("webrtcEncryption: true"));
  assert.ok(config.includes("webrtcAddress: :8889"));
});

test("MediaMTX délègue toute autorisation à NAXA et ferme l'administration", () => {
  assert.ok(config.includes("authMethod: http"));
  assert.ok(config.includes("authHTTPExclude: []"));
  assert.ok(config.includes("authHTTPAddress: https://app.example.com/api/security/mediamtx/auth"));
  assert.ok(config.includes("api: false"));
  assert.ok(config.includes("metrics: false"));
  assert.ok(config.includes("pprof: false"));
  assert.ok(config.includes("playback: false"));
  assert.ok(config.includes("webrtcAllowOrigins:"));
  assert.doesNotMatch(config, /webrtcAllowOrigins:\s*\n\s*-\s*["']?\*|authHTTPExclude:\s*\n\s*-\s*action/i);
});

test("durcissement conteneur, pas de publication non autorisée ni d'enregistrement implicite", () => {
  assert.ok(compose.includes("read_only: true"));
  assert.ok(compose.includes("cap_drop:"));
  assert.ok(compose.includes("no-new-privileges:true"));
  assert.ok(compose.includes("mediamtx_tls_key"));
  assert.ok(config.includes("overridePublisher: false"));
  assert.ok(config.includes("record: false"));
  assert.ok(readme.includes("phase 9"));
  assert.ok(readme.includes("action=publish"));
  assert.ok(readme.includes("protocol=rtsp"));
  assert.ok(readme.includes("Aucun TURN n'est actuellement configuré"));
  assert.ok(readme.includes("Aucune conservation vidéo"));
});

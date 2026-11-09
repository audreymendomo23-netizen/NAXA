const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  makeSignedHeartbeat,
  secureApiBase,
  ensurePrivateDirectory,
  writePrivateFile,
  readSecureConfig,
  startFfmpegPublisher,
} = require("../services/security-gateway/agent.cjs");

test("heartbeat Ed25519 : signature liée au corps, à la passerelle, à l'horodatage et au nonce", () => {
  const pair = crypto.generateKeyPairSync("ed25519");
  const gatewayId = "a4a4b1a1-4d0d-4b83-8db4-ae7c1b19ea20";
  const signed = makeSignedHeartbeat({
    gatewayId,
    privateKey: pair.privateKey,
    hostname: "naxa-edge-01",
    nowMs: 1794092400000,
    nonce: crypto.randomBytes(24).toString("base64url"),
  });
  const headers = signed.headers;
  const hash = crypto.createHash("sha256").update(signed.rawBody, "utf8").digest("hex");
  const canonical = Buffer.from([
    gatewayId,
    headers["X-NAXA-Timestamp"],
    headers["X-NAXA-Nonce"],
    hash,
  ].join("\n"), "utf8");
  assert.equal(crypto.verify(null, canonical, pair.publicKey, Buffer.from(headers["X-NAXA-Signature"], "base64url")), true);
  assert.equal(crypto.verify(null, Buffer.from(canonical.toString() + "x"), pair.publicKey, Buffer.from(headers["X-NAXA-Signature"], "base64url")), false);
  assert.equal(headers["X-NAXA-Gateway-ID"], gatewayId);
  assert.equal(headers["X-NAXA-Nonce"].length, 32);
});

test("URL API : HTTPS obligatoire hors localhost et identifiants interdits", () => {
  assert.equal(secureApiBase("https://naxa.example/").toString(), "https://naxa.example");
  assert.equal(secureApiBase("http://127.0.0.1:3000").toString(), "http://127.0.0.1:3000");
  assert.throws(() => secureApiBase("http://naxa.example"), /HTTPS/);
  assert.throws(() => secureApiBase("https://user:pass@naxa.example"), /identifiant/);
  assert.throws(() => secureApiBase("https://naxa.example?token=abc"), /paramètre/);
});

test("stockage local : dossier 0700, clés/configuration 0600 et configuration sans code bootstrap", (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "naxa-gateway-"));
  try {
    ensurePrivateDirectory(base);
    const privateKey = crypto.generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const privateKeyPath = path.join(base, "gateway-ed25519-private.pem");
    writePrivateFile(privateKeyPath, privateKey);
    const config = {
      apiBaseUrl: "https://naxa.example",
      gatewayId: "a4a4b1a1-4d0d-4b83-8db4-ae7c1b19ea20",
      privateKeyPath,
      keyFingerprint: "0".repeat(64),
      agentVersion: "0.1.0",
      enrolledAt: new Date().toISOString(),
    };
    writePrivateFile(path.join(base, "config.json"), JSON.stringify(config));
    const loaded = readSecureConfig(base);
    assert.equal(loaded.privateKey.asymmetricKeyType, "ed25519");
    const storedConfig = fs.readFileSync(path.join(base, "config.json"), "utf8");
    assert.equal(storedConfig.includes("bootstrapToken"), false);
    if (process.platform !== "win32") {
      assert.equal(fs.statSync(base).mode & 0o777, 0o700);
      assert.equal(fs.statSync(privateKeyPath).mode & 0o777, 0o600);
      assert.equal(fs.statSync(path.join(base, "config.json")).mode & 0o777, 0o600);
    }
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("le code de jumelage est lu depuis stdin protégé, jamais depuis un argument de processus", () => {
  const source = fs.readFileSync(path.join(__dirname, "../services/security-gateway/agent.cjs"), "utf8");
  assert.match(source, /--token-stdin/);
  assert.match(source, /process\.stdin\.isTTY/);
  assert.match(source, /fs\.readFileSync\(0, "utf8"\)/);
  assert.match(source, /if \(flags\.token\) throw/);
});


const { validateLocalRtspSource, writeCameraStreamConfigs, readCameraStreamConfigs, buildPublishFfmpegArgs } =
  require("../services/security-gateway/agent.cjs");
const { createPrivateRtspManifest } = require("../services/security-gateway/recording.cjs");

test("URI caméra : RTSP/RTSPS local uniquement, rejet des IP publiques", () => {
  assert.equal(validateLocalRtspSource("rtsp://operator:secret@192.168.1.20:554/Streaming/Channels/101").protocol, "rtsp:");
  assert.equal(validateLocalRtspSource("rtsps://camera.local:322/stream").hostname, "camera.local");
  assert.throws(() => validateLocalRtspSource("rtsp://camera.example.com/live"), /local/);
  assert.throws(() => validateLocalRtspSource("rtsp://camera/live"), /local/);
  assert.throws(() => validateLocalRtspSource("http://192.168.1.20/video"), /RTSP/);
  assert.throws(() => validateLocalRtspSource("rtsp://operator:secret@8.8.8.8/live"), /local/);
});

test("URI et secrets caméra : AES-256-GCM, permissions 0600 et fichier chiffré", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "naxa-camera-stream-"));
  try {
    ensurePrivateDirectory(base);
    const cameraId = "a4a4b1a1-4d0d-4b83-8db4-ae7c1b19ea20";
    const source = "rtsp://operator:CameraSecret123@192.168.1.20:554/Streaming/Channels/101";
    writeCameraStreamConfigs(base, [{ cameraId, sourceUrl: source }]);
    const encrypted = fs.readFileSync(path.join(base, "camera-streams.enc"), "utf8");
    assert.equal(encrypted.includes("CameraSecret123"), false);
    assert.equal(readCameraStreamConfigs(base)[0].sourceUrl, source);
    if (process.platform !== "win32") {
      assert.equal(fs.statSync(path.join(base, "camera-streams.key")).mode & 0o777, 0o600);
      assert.equal(fs.statSync(path.join(base, "camera-streams.enc")).mode & 0o777, 0o600);
    }
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test("FFmpeg : source caméra et ticket publisher absents de la ligne de commande", () => {
  const manifest = createPrivateRtspManifest(
    "rtsp://operator:CameraSecret123@192.168.1.20:554/Streaming/Channels/101",
  );
  try {
    const localTarget = "rtsp://127.0.0.1:45321/naxa/a4a4b1a1-4d0d-4b83-8db4-ae7c1b19ea20/a4a4b1a1-4d0d-4b83-8db4-ae7c1b19ea21";
    const args = buildPublishFfmpegArgs(manifest.path, localTarget);
    assert.ok(args.includes("-protocol_whitelist"));
    assert.ok(args.includes("-f") && args[args.indexOf("-f") + 1] === "concat");
    assert.ok(args.includes("-rtsp_transport"));
    assert.ok(args.includes("-c:v"));
    assert.ok(args.includes("copy"));
    assert.ok(args.includes("-an"));
    assert.ok(args.includes("-progress"));
    assert.ok(args.includes(localTarget));
    assert.equal(args.join(" ").includes("CameraSecret123"), false);
    assert.equal(args.join(" ").includes("shortticket"), false);
    assert.equal(args.join(" ").includes("video.example.test"), false);
    assert.ok(fs.readFileSync(manifest.path, "utf8").includes("CameraSecret123"));
    if (process.platform !== "win32") {
      assert.equal(fs.statSync(manifest.path).mode & 0o777, 0o600);
    }
  } finally {
    manifest.cleanup();
  }
});

const { buildSecurityEventPayload } = require("../services/security-gateway/agent.cjs");
test("agent événements : empreinte stable et métadonnées bornées", () => {
  const payload = {
    cameraId: "a4a4b1a1-4d0d-4b83-8db4-ae7c1b19ea20",
    eventType: "motion", sourceType: "onvif",
    summary: "Mouvement détecté par la caméra",
    detectedAt: "2026-11-08T04:30:00.000Z",
    confidence: null, metadata: { event_code: "Rule-1" },
  };
  const first = buildSecurityEventPayload(payload);
  const second = buildSecurityEventPayload(payload);
  assert.equal(first.sourceFingerprint, second.sourceFingerprint);
  assert.match(first.sourceFingerprint, /^[0-9a-f]{64}$/);
  assert.throws(() => buildSecurityEventPayload({ ...payload, metadata: { rtsp_url: "rtsp://camera" } }));
  assert.throws(() => buildSecurityEventPayload({ ...payload, summary: "secret password=abc" }));
});

test("agent : collecteur Pull-Point configurable par stdin", () => {
  const source = fs.readFileSync(path.join(__dirname, "../services/security-gateway/agent.cjs"), "utf8");
  assert.ok(source.includes("configure-onvif-events"));
  assert.ok(source.includes("--credentials-stdin"));
  assert.ok(source.includes("runPullPointCollector"));
  assert.ok(source.includes("readOnvifEventConfigs"));
});


test("publisher FFmpeg : ne démarre pas après un arrêt déjà demandé", async () => {
  const controller = new AbortController();
  controller.abort();
  const previousBin = process.env.NAXA_FFMPEG_BIN;
  process.env.NAXA_FFMPEG_BIN = "naxa-ffmpeg-must-not-be-started";
  try {
    const result = await startFfmpegPublisher({
      sourceUrl: "rtsp://camera.local/live",
      publishUrl: "rtsp://127.0.0.1:45321/naxa/a4a4b1a1-4d0d-4b83-8db4-ae7c1b19ea20/a4a4b1a1-4d0d-4b83-8db4-ae7c1b19ea21",
      signal: controller.signal,
      onFirstFrame: () => {},
    });
    assert.equal(result.exitSignal, "aborted");
    assert.equal(result.frameCount, 0);
    assert.equal(result.spawnError, undefined);
  } finally {
    if (previousBin === undefined) delete process.env.NAXA_FFMPEG_BIN;
    else process.env.NAXA_FFMPEG_BIN = previousBin;
  }
});

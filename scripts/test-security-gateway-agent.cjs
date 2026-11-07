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

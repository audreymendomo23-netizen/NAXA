#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { discoverOnvifCameras } = require("./onvif-discovery.cjs");

const AGENT_VERSION = "0.1.0";
const DEFAULT_STATE_DIR = "/var/lib/naxa-security-gateway";

function buildCanonicalMessage(gatewayId, timestamp, nonce, rawBody) {
  const bodyHash = crypto.createHash("sha256").update(rawBody, "utf8").digest("hex");
  return Buffer.from(`${gatewayId}\n${timestamp}\n${nonce}\n${bodyHash}`, "utf8");
}

function makeSignedHeartbeat({ gatewayId, privateKey, hostname = os.hostname(), nowMs = Date.now(), nonce = crypto.randomBytes(24).toString("base64url") }) {
  const payload = {
    agentVersion: AGENT_VERSION,
    hostname: String(hostname).replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 100) || "naxa-gateway",
    capabilities: ["heartbeat"],
    reportedAt: new Date(nowMs).toISOString(),
  };
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Math.floor(nowMs / 1000));
  const canonical = buildCanonicalMessage(gatewayId, timestamp, nonce, rawBody);
  const signature = crypto.sign(null, canonical, privateKey).toString("base64url");
  return {
    rawBody,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-NAXA-Gateway-ID": gatewayId,
      "X-NAXA-Timestamp": timestamp,
      "X-NAXA-Nonce": nonce,
      "X-NAXA-Signature": signature,
    },
  };
}

function secureApiBase(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("L'API de la passerelle doit utiliser HTTPS (HTTP local autorisé uniquement pour les tests).");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("L'URL API ne doit contenir aucun identifiant, paramètre ou fragment.");
  }
  return url.toString().replace(/\/$/, "");
}

function ensurePrivateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") {
    fs.chmodSync(directory, 0o700);
    const mode = fs.statSync(directory).mode & 0o777;
    if ((mode & 0o077) !== 0) throw new Error("Le dossier d'état de la passerelle doit être privé (mode 0700).");
  }
}

function writePrivateFile(filePath, content) {
  const tempPath = filePath + ".tmp-" + crypto.randomBytes(6).toString("hex");
  fs.writeFileSync(tempPath, content, { encoding: "utf8", mode: 0o600, flag: "wx" });
  if (process.platform !== "win32") fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, filePath);
}

function readSecureConfig(stateDir) {
  const configPath = path.join(stateDir, "config.json");
  const privateKeyPath = path.join(stateDir, "gateway-ed25519-private.pem");
  if (!fs.existsSync(configPath) || !fs.existsSync(privateKeyPath)) {
    throw new Error("Passerelle non enrôlée. Exécutez d'abord la commande enroll.");
  }
  if (process.platform !== "win32") {
    for (const file of [configPath, privateKeyPath]) {
      if ((fs.statSync(file).mode & 0o077) !== 0) throw new Error("Permissions trop ouvertes sur " + file + " ; appliquez chmod 600.");
    }
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const resolvedPrivateKey = path.resolve(privateKeyPath);
  if (!config.gatewayId || !config.apiBaseUrl || config.privateKeyPath !== resolvedPrivateKey) {
    throw new Error("Configuration de passerelle invalide.");
  }
  const privateKey = crypto.createPrivateKey(fs.readFileSync(resolvedPrivateKey, "utf8"));
  if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("La clé privée locale doit être Ed25519.");
  return { ...config, privateKey };
}

function parseFlags(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!key.startsWith("--")) throw new Error("Option inconnue : " + key);
    if (key === "--token-stdin" || key === "--confirm-local-network") {
      values["token-stdin"] = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error("Valeur manquante pour " + key);
    values[key.slice(2)] = value;
    index += 1;
  }
  return values;
}

async function enroll(args) {
  const flags = parseFlags(args);
  const apiBaseUrl = secureApiBase(flags["api-url"] || "");
  const gatewayId = String(flags["gateway-id"] || "");
  if (flags.token) throw new Error("Ne passez jamais le code en argument. Utilisez --token-stdin avec un fichier sécurisé en entrée.");
  if (!flags["token-stdin"] || process.stdin.isTTY) throw new Error("Utilisez --token-stdin avec un fichier d'entrée protégé en mode 0600.");
  const token = fs.readFileSync(0, "utf8").trim();
  const stateDir = path.resolve(flags["state-dir"] || DEFAULT_STATE_DIR);
  if (!/^[0-9a-f-]{36}$/i.test(gatewayId) || !/^[0-9a-f]{64}$/i.test(token)) {
    throw new Error("Identifiant passerelle ou code à usage unique invalide.");
  }

  ensurePrivateDirectory(stateDir);
  const privateKeyPath = path.join(stateDir, "gateway-ed25519-private.pem");
  let privateKey;
  let publicKey;
  if (fs.existsSync(privateKeyPath)) {
    privateKey = crypto.createPrivateKey(fs.readFileSync(privateKeyPath, "utf8"));
    if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("La clé privée locale existante n'est pas Ed25519.");
    publicKey = crypto.createPublicKey(privateKey);
  } else {
    const pair = crypto.generateKeyPairSync("ed25519");
    privateKey = pair.privateKey;
    publicKey = pair.publicKey;
    writePrivateFile(privateKeyPath, privateKey.export({ type: "pkcs8", format: "pem" }).toString());
  }
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const fingerprint = crypto.createHash("sha256")
    .update(publicKey.export({ type: "spki", format: "der" })).digest("hex");

  const response = await fetch(apiBaseUrl + "/api/security/gateway/enroll", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ gatewayId, token, publicKeyPem }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
    redirect: "error",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) {
    throw new Error(result.error || "Le serveur NAXA a refusé le jumelage.");
  }

  const config = {
    apiBaseUrl,
    gatewayId,
    privateKeyPath,
    keyFingerprint: fingerprint,
    agentVersion: AGENT_VERSION,
    enrolledAt: new Date().toISOString(),
  };
  writePrivateFile(path.join(stateDir, "config.json"), JSON.stringify(config, null, 2) + "\n");
  console.log("Passerelle enrôlée. Empreinte Ed25519 : " + fingerprint);
  console.log("La clé privée reste dans le stockage local protégé ; le code de jumelage n'a pas été conservé.");
  console.log("État serveur initial : pending. Le tunnel ne sera connecté qu'après un heartbeat signé.");
}

async function heartbeat(config) {
  const requestData = makeSignedHeartbeat({
    gatewayId: config.gatewayId,
    privateKey: config.privateKey,
  });
  const response = await fetch(config.apiBaseUrl + "/api/security/gateway/heartbeat", {
    method: "POST",
    headers: requestData.headers,
    body: requestData.rawBody,
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
    redirect: "error",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) {
    throw new Error(result.error || "Heartbeat refusé (HTTP " + response.status + ").");
  }
  console.log(new Date().toISOString() + " — heartbeat signé accepté ; tunnel=" + result.tunnelStatus);
}

async function run(args) {
  const flags = parseFlags(args);
  const stateDir = path.resolve(flags["state-dir"] || DEFAULT_STATE_DIR);
  const intervalSeconds = Number(flags.interval || 60);
  if (!Number.isInteger(intervalSeconds) || intervalSeconds < 30 || intervalSeconds > 3600) {
    throw new Error("L'intervalle doit être compris entre 30 et 3600 secondes.");
  }
  const config = readSecureConfig(stateDir);
  const runOnce = async () => {
    try {
      await heartbeat(config);
    } catch (error) {
      console.error(new Date().toISOString() + " — " + error.message);
    }
  };
  await runOnce();
  const timer = setInterval(runOnce, intervalSeconds * 1000);
  const stop = () => { clearInterval(timer); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  console.log("Agent NAXA actif ; intervalle " + intervalSeconds + " s. Aucun port entrant n'est ouvert.");
}

async function discover(args) {
  const flags = parseFlags(args);
  if (!flags["confirm-local-network"]) {
    throw new Error("Découverte désactivée par défaut. Confirmez explicitement le réseau local avec --confirm-local-network.");
  }
  const timeoutMs = Number(flags["timeout-ms"] || 3500);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 8000) {
    throw new Error("Le délai de découverte doit être compris entre 1000 et 8000 ms.");
  }
  const devices = await discoverOnvifCameras({ timeoutMs, maxDevices: 64 });
  console.log(JSON.stringify({
    protocol: "ONVIF WS-Discovery",
    scope: "IPv4 multicast local uniquement (239.255.255.250:3702, TTL=1)",
    transmittedCredentials: false,
    contactedCameraEndpoints: false,
    devices,
    count: devices.length,
  }, null, 2));
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "enroll") return enroll(args);
  if (command === "discover") return discover(args);
  if (command === "heartbeat") {
    const flags = parseFlags(args);
    return heartbeat(readSecureConfig(path.resolve(flags["state-dir"] || DEFAULT_STATE_DIR)));
  }
  if (command === "run") return run(args);
  throw new Error("Commande attendue : enroll | heartbeat | discover | run");
}

if (require.main === module) {
  main().catch((error) => {
    console.error("NAXA Security Gateway :", error.message);
    process.exitCode = 1;
  });
}

module.exports = { AGENT_VERSION, buildCanonicalMessage, makeSignedHeartbeat, secureApiBase, ensurePrivateDirectory, writePrivateFile, readSecureConfig };

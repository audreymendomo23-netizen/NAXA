#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { discoverOnvifCameras } = require("./onvif-discovery.cjs");
const { inspectOnvifDevice } = require("./onvif-inspection.cjs");
const { readOnvifEventConfigs, writeOnvifEventConfigs, runPullPointCollector } = require("./onvif-events.cjs");
const { readRecordingPolicy, writeRecordingPolicy, runCameraRecorder, createPrivateRtspManifest, buildFfmpegInputArgs } = require("./recording.cjs");
const { createRtspPublishProxy } = require("./rtsp-publish-proxy.cjs");

const AGENT_VERSION = "0.1.0";
const DEFAULT_STATE_DIR = "/var/lib/naxa-security-gateway";
const CAMERA_STREAM_KEY_FILE = "camera-streams.key";
const CAMERA_STREAM_CONFIG_FILE = "camera-streams.enc";
const CAMERA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildCanonicalMessage(gatewayId, timestamp, nonce, rawBody) {
  const bodyHash = crypto.createHash("sha256").update(rawBody, "utf8").digest("hex");
  return Buffer.from(`${gatewayId}\n${timestamp}\n${nonce}\n${bodyHash}`, "utf8");
}

function makeSignedGatewayHeaders({ gatewayId, privateKey, rawBody, nowMs = Date.now(), nonce = crypto.randomBytes(24).toString("base64url") }) {
  const timestamp = String(Math.floor(nowMs / 1000));
  const canonical = buildCanonicalMessage(gatewayId, timestamp, nonce, rawBody);
  const signature = crypto.sign(null, canonical, privateKey).toString("base64url");
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-NAXA-Gateway-ID": gatewayId,
    "X-NAXA-Timestamp": timestamp,
    "X-NAXA-Nonce": nonce,
    "X-NAXA-Signature": signature,
  };
}

function makeSignedHeartbeat({ gatewayId, privateKey, hostname = os.hostname(), nowMs = Date.now(), nonce = crypto.randomBytes(24).toString("base64url") }) {
  const payload = {
    agentVersion: AGENT_VERSION,
    hostname: String(hostname).replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 100) || "naxa-gateway",
    capabilities: ["heartbeat"],
    reportedAt: new Date(nowMs).toISOString(),
  };
  const rawBody = JSON.stringify(payload);
  return {
    rawBody,
    headers: makeSignedGatewayHeaders({ gatewayId, privateKey, rawBody, nowMs, nonce }),
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
    if (key === "--token-stdin" || key === "--confirm-local-network" || key === "--submit" || key === "--source-stdin" || key === "--event-stdin" || key === "--credentials-stdin") {
      values[key.slice(2)] = true;
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
  const controller = new AbortController();
  const cameras = readCameraStreamConfigs(stateDir);
  const publishers = cameras.map((camera) => runCameraPublisher(config, camera, controller.signal));
  const eventCollectors = readOnvifEventConfigs(stateDir).map((camera) => runCameraOnvifEvents(config, camera, controller.signal));
  const recordingPolicies = readRecordingPolicy(stateDir, cameras.map((camera) => camera.cameraId));
  const recordingWorkers = recordingPolicies.map((policy) => {
    const camera = cameras.find((item) => item.cameraId === policy.cameraId);
    if (!camera) return Promise.resolve();
    return runCameraRecorder({ camera, policy, stateDir, signal: controller.signal });
  });
  void Promise.all([...publishers, ...eventCollectors, ...recordingWorkers]);
  const stop = () => { clearInterval(timer); controller.abort(); };
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
  let reportStatus = "local_only";
  if (flags.submit) {
    const config = readSecureConfig(path.resolve(flags["state-dir"] || DEFAULT_STATE_DIR));
    const rawBody = JSON.stringify({
      agentVersion: AGENT_VERSION,
      reportedAt: new Date().toISOString(),
      devices,
    });
    const response = await fetch(config.apiBaseUrl + "/api/security/gateway/discoveries", {
      method: "POST",
      headers: makeSignedGatewayHeaders({
        gatewayId: config.gatewayId,
        privateKey: config.privateKey,
        rawBody,
      }),
      body: rawBody,
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
      redirect: "error",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok !== true) {
      throw new Error(result.error || "NAXA a refusé le rapport de découverte (HTTP " + response.status + ").");
    }
    reportStatus = "sent_for_human_review";
    console.log("Rapport transmis à NAXA ; candidats en attente de validation Promoteur : " + Number(result.candidateCount || 0));
  }
  console.log(JSON.stringify({
    protocol: "ONVIF WS-Discovery",
    scope: "IPv4 multicast local uniquement (239.255.255.250:3702, TTL=1)",
    transmittedCredentials: false,
    contactedCameraEndpoints: false,
    reportStatus,
    devices,
    count: devices.length,
  }, null, 2));
}


async function inspect(args) {
  const flags = parseFlags(args);
  if (!flags["confirm-local-network"]) {
    throw new Error("Diagnostic désactivé par défaut. Confirmez explicitement le réseau local avec --confirm-local-network.");
  }
  if (flags.submit) {
    throw new Error("Le diagnostic ONVIF ne transmet aucune donnée. Retirez --submit.");
  }
  const endpoint = String(flags.endpoint || "");
  const sourceAddress = String(flags["source-address"] || "");
  if (!endpoint || !sourceAddress) {
    throw new Error("Indiquez --endpoint et --source-address (adresse IPv4 privée de la caméra).");
  }
  const timeoutMs = Number(flags["timeout-ms"] || 4000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 10000) {
    throw new Error("Le délai du diagnostic doit être compris entre 1000 et 10000 ms.");
  }
  const result = await inspectOnvifDevice({ endpoint, sourceAddress, timeoutMs });
  console.log(JSON.stringify({
    protocol: "ONVIF Device Service",
    credentialsSent: false,
    streamOpened: false,
    dataTransmitted: false,
    result,
  }, null, 2));
}


function validateLocalRtspSource(value) {
  if (typeof value !== "string" || value.length < 12 || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) throw new Error("URI caméra invalide.");
  let url;
  try { url = new URL(value); } catch { throw new Error("URI caméra invalide."); }
  if (!["rtsp:", "rtsps:"].includes(url.protocol) || url.hash) throw new Error("Seuls RTSP et RTSPS locaux sont autorisés.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const ipVersion = require("node:net").isIP(host);
  let local = false;
  if (ipVersion === 4) {
    const octets = host.split(".").map(Number);
    local = octets[0] === 10 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) || (octets[0] === 169 && octets[1] === 254);
  } else if (ipVersion === 6) {
    local = host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
  } else {
    local = host.endsWith(".local") || host.endsWith(".lan") || host.endsWith(".home.arpa");
  }
  if (!local || !host || host === "localhost") throw new Error("La caméra doit être sur une IP privée ou un DNS local.");
  return url;
}

function readStreamEncryptionKey(stateDir) {
  const keyPath = path.join(stateDir, CAMERA_STREAM_KEY_FILE);
  if (!fs.existsSync(keyPath)) return null;
  if (process.platform !== "win32" && (fs.statSync(keyPath).mode & 0o077) !== 0) throw new Error("Permissions clé caméra trop ouvertes.");
  const value = fs.readFileSync(keyPath, "utf8").trim();
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error("Clé locale des caméras invalide.");
  return Buffer.from(value, "hex");
}

function readCameraStreamConfigs(stateDir) {
  const filePath = path.join(stateDir, CAMERA_STREAM_CONFIG_FILE);
  if (!fs.existsSync(filePath)) return [];
  if (process.platform !== "win32" && (fs.statSync(filePath).mode & 0o077) !== 0) throw new Error("Permissions paramètres caméra trop ouvertes.");
  const key = readStreamEncryptionKey(stateDir);
  if (!key) throw new Error("Clé de chiffrement locale des caméras manquante.");
  const envelope = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (envelope.version !== 1 || !/^[0-9a-f]{24}$/.test(envelope.iv) || !/^[0-9a-f]{32}$/.test(envelope.tag) || !/^[0-9a-f]+$/.test(envelope.ciphertext)) {
    throw new Error("Configuration caméra chiffrée invalide.");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "hex"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "hex"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "hex")), decipher.final()]).toString("utf8");
  const entries = JSON.parse(plaintext);
  if (!Array.isArray(entries) || entries.length > 64) throw new Error("Inventaire de flux local invalide.");
  return entries.map((item) => {
    if (!item || !CAMERA_UUID.test(item.cameraId) || typeof item.sourceUrl !== "string") throw new Error("Entrée de flux local invalide.");
    validateLocalRtspSource(item.sourceUrl);
    return { cameraId: item.cameraId, sourceUrl: item.sourceUrl };
  });
}

function writeCameraStreamConfigs(stateDir, entries) {
  ensurePrivateDirectory(stateDir);
  if (!Array.isArray(entries) || entries.length > 64) throw new Error("Maximum 64 caméras locales.");
  const normalized = entries.map((item) => {
    if (!item || !CAMERA_UUID.test(item.cameraId)) throw new Error("Identifiant caméra invalide.");
    validateLocalRtspSource(item.sourceUrl);
    return { cameraId: item.cameraId, sourceUrl: item.sourceUrl };
  });
  const keyPath = path.join(stateDir, CAMERA_STREAM_KEY_FILE);
  let key = readStreamEncryptionKey(stateDir);
  if (!key) { key = crypto.randomBytes(32); writePrivateFile(keyPath, key.toString("hex") + "\n"); }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(normalized), "utf8"), cipher.final()]);
  writePrivateFile(path.join(stateDir, CAMERA_STREAM_CONFIG_FILE), JSON.stringify({
    version: 1, iv: iv.toString("hex"), tag: cipher.getAuthTag().toString("hex"), ciphertext: ciphertext.toString("hex"),
  }) + "\n");
}

function buildPublishFfmpegArgs(inputManifestPath, publishUrl) {
  const target = new URL(publishUrl);
  if (target.protocol !== "rtsp:" || target.hostname !== "127.0.0.1" ||
    target.username || target.password || target.search || target.hash ||
    !/^\/naxa\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i.test(target.pathname)) {
    throw new Error("Destination RTSP loopback invalide.");
  }
  return [
    "-hide_banner", "-nostdin", "-loglevel", "error",
    ...buildFfmpegInputArgs(inputManifestPath),
    "-map", "0:v:0", "-an", "-c:v", "copy", "-progress", "pipe:1", "-nostats", "-f", "rtsp",
    "-rtsp_transport", "tcp", publishUrl,
  ];
}

async function requestStreamPublishTicket(config, cameraId) {
  if (!CAMERA_UUID.test(cameraId)) throw new Error("Identifiant caméra invalide.");
  const rawBody = JSON.stringify({ cameraId });
  const response = await fetch(config.apiBaseUrl + "/api/security/gateway/stream-publish-token", {
    method: "POST",
    headers: makeSignedGatewayHeaders({ gatewayId: config.gatewayId, privateKey: config.privateKey, rawBody }),
    body: rawBody, signal: AbortSignal.timeout(15000), cache: "no-store", redirect: "error",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true || typeof result.publishUrl !== "string" || typeof result.expiresAt !== "string") {
    throw new Error("Ticket de publication refusé (HTTP " + response.status + ").");
  }
  const url = new URL(result.publishUrl);
  if (url.protocol !== "rtsps:" || url.username !== config.gatewayId || !url.password ||
    !/^\/naxa\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i.test(url.pathname)) throw new Error("Ticket RTSPS invalide.");
  return { publishUrl: url.toString(), expiresAt: result.expiresAt };
}

async function reportStreamHealth(config, cameraId, state, frameCount) {
  const rawBody = JSON.stringify({ cameraId, state, frameCount });
  const response = await fetch(config.apiBaseUrl + "/api/security/gateway/stream-health", {
    method: "POST",
    headers: makeSignedGatewayHeaders({ gatewayId: config.gatewayId, privateKey: config.privateKey, rawBody }),
    body: rawBody, signal: AbortSignal.timeout(10000), cache: "no-store", redirect: "error",
  });
  if (!response.ok) throw new Error("Statut caméra refusé (HTTP " + response.status + ").");
}

function startFfmpegPublisher({ sourceUrl, publishUrl, onFirstFrame, signal, spawnImpl = spawn }) {
  return new Promise((resolve) => {
    let inputManifest = null;
    let args;
    let finished = false, frameCount = 0, stdoutBuffer = "", child;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      signal.removeEventListener("abort", onAbort);
      if (inputManifest) inputManifest.cleanup();
      resolve({ ...result, frameCount });
    };
    const onAbort = () => { if (child && child.exitCode === null) child.kill("SIGTERM"); };
    // An abort may arrive while the publisher ticket request is pending.
    // Do not create credentials manifests or spawn FFmpeg after shutdown starts.
    if (signal.aborted) {
      finish({ code: null, exitSignal: "aborted" });
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      inputManifest = createPrivateRtspManifest(sourceUrl);
      args = buildPublishFfmpegArgs(inputManifest.path, publishUrl);
      child = spawnImpl(process.env.NAXA_FFMPEG_BIN || "ffmpeg", args, {
        shell: false, windowsHide: true, stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      finish({ code: null, spawnError: "SPAWN_FAILED" });
      return;
    }
    child.once("error", (error) => finish({
      code: null,
      spawnError: error && error.code === "ENOENT" ? "FFMPEG_MISSING" : "SPAWN_FAILED",
    }));
    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString("utf8");
      if (stdoutBuffer.length > 8192) stdoutBuffer = stdoutBuffer.slice(-4096);
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || "";
      for (const line of lines) {
        const match = /^frame=\s*(\d+)$/.exec(line.trim());
        if (!match) continue;
        const count = Number(match[1]);
        if (Number.isSafeInteger(count)) frameCount = Math.max(frameCount, count);
        if (frameCount > 0) onFirstFrame(frameCount);
      }
    });
    child.once("exit", (code, exitSignal) => finish({ code, exitSignal }));
  });
}

async function runCameraPublisher(config, camera, signal) {
  let backoffMs = 5000;
  const outage = { detectedAt: null, reported: false };
  while (!signal.aborted) {
    let online = false, onlineReport = Promise.resolve();
    let proxy = null;
    try {
      const ticket = await requestStreamPublishTicket(config, camera.cameraId);
      proxy = createRtspPublishProxy(ticket.publishUrl);
      const localDestination = await proxy.listen();
      const result = await startFfmpegPublisher({
        sourceUrl: camera.sourceUrl, publishUrl: localDestination.url, signal,
        onFirstFrame: (frames) => {
          if (online) return;
          online = true;
          if (outage.detectedAt) {
            outage.detectedAt = null;
            outage.reported = false;
          }
          onlineReport = reportStreamHealth(config, camera.cameraId, "online", frames).catch(() => { online = false; });
        },
      });
      await onlineReport;
      if (online) {
        await reportStreamHealth(config, camera.cameraId, "offline", result.frameCount).catch(() => {});
        if (!signal.aborted && result.frameCount > 0 && !outage.detectedAt) {
          outage.detectedAt = new Date().toISOString();
        }
      }
      await reportPublisherSignalLoss(config, camera.cameraId, outage);
      if (result.spawnError === "FFMPEG_MISSING") {
        console.error("NAXA Security : FFmpeg absent sur la passerelle ; installation requise.");
        backoffMs = 300000;
      } else if (result.frameCount > 0 && online) {
        backoffMs = 5000;
      } else backoffMs = Math.min(300000, Math.max(5000, backoffMs * 2));
    } catch (error) {
      console.error("NAXA Security : publication caméra indisponible (" +
        (error instanceof Error ? error.message.slice(0, 100) : "erreur inconnue") + ").");
      await reportPublisherSignalLoss(config, camera.cameraId, outage);
      backoffMs = Math.min(300000, Math.max(5000, backoffMs * 2));
    } finally {
      if (proxy) await proxy.close().catch(() => {});
    }
    await waitDelay(backoffMs, signal);
  }
}

async function runCameraOnvifEvents(config, camera, signal) {
  let backoffMs = 5000;
  while (!signal.aborted) {
    try {
      await runPullPointCollector({
        ...camera,
        signal,
        onEvent: async (event) => { await reportSecurityEvent(config, event); },
      });
      backoffMs = 5000;
    } catch {
      console.warn("NAXA Security : abonnement ONVIF indisponible pour une caméra configurée ; nouvelle tentative prévue.");
      backoffMs = Math.min(300000, Math.max(5000, backoffMs * 2));
    }
    await waitDelay(backoffMs, signal);
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "enroll") return enroll(args);
  if (command === "discover") return discover(args);
  if (command === "inspect") return inspect(args);
  if (command === "configure-stream") return configureStream(args);
  if (command === "configure-recording") return configureRecording(args);
  if (command === "configure-onvif-events") return configureOnvifEvents(args);
  if (command === "report-event") return submitSecurityEvent(args);
  if (command === "heartbeat") {
    const flags = parseFlags(args);
    return heartbeat(readSecureConfig(path.resolve(flags["state-dir"] || DEFAULT_STATE_DIR)));
  }
  if (command === "run") return run(args);
  throw new Error("Commande attendue : enroll | heartbeat | discover | inspect | configure-stream | configure-recording | configure-onvif-events | report-event | run");
}

if (require.main === module) {
  main().catch((error) => {
    console.error("NAXA Security Gateway :", error.message);
    process.exitCode = 1;
  });
}

module.exports = { AGENT_VERSION, buildCanonicalMessage, makeSignedGatewayHeaders, makeSignedHeartbeat, secureApiBase, ensurePrivateDirectory, writePrivateFile, readSecureConfig, parseFlags, validateLocalRtspSource, writeCameraStreamConfigs, readCameraStreamConfigs, buildPublishFfmpegArgs, startFfmpegPublisher, requestStreamPublishTicket, buildSecurityEventPayload, reportSecurityEvent };

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");

const RECORDING_POLICY_FILE = "recording-policy.json";
const RECORDING_DIRECTORY = "recordings";
const CAMERA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_SEGMENT_SECONDS = 30;
const MAX_SEGMENT_SECONDS = 900;
const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 365;
const MIN_QUOTA_BYTES = 1024 * 1024 * 1024;
const MAX_QUOTA_BYTES = 20 * 1024 * 1024 * 1024 * 1024;

function ensurePrivateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Répertoire d'enregistrement non sûr.");
  if (process.platform !== "win32") fs.chmodSync(directory, 0o700);
}

function writePrivateFile(filePath, content) {
  const directory = path.dirname(filePath);
  ensurePrivateDirectory(directory);
  const temporaryPath = filePath + ".tmp-" + process.pid + "-" + Date.now();
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
    fs.writeFileSync(descriptor, content, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporaryPath, filePath);
    if (process.platform !== "win32") fs.chmodSync(filePath, 0o600);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try { fs.unlinkSync(temporaryPath); } catch {}
    throw error;
  }
}

function createPrivateRtspManifest(sourceUrl) {
  const validated = validateLocalRtspSource(sourceUrl);
  const temporaryDirectory = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "naxa-rtsp-input-"));
  ensurePrivateDirectory(temporaryDirectory);
  const manifestPath = path.join(temporaryDirectory, "source.ffconcat");
  const manifestUrl = validated.toString().replace(/'/g, "%27").replace(/\\/g, "%5C");
  try {
    writePrivateFile(
      manifestPath,
      "ffconcat version 1.0\nfile '" + manifestUrl + "'\noption rtsp_transport tcp\n",
    );
  } catch (error) {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }
  return {
    path: manifestPath,
    cleanup() {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    },
  };
}

function buildFfmpegInputArgs(manifestPath) {
  if (typeof manifestPath !== "string" || !path.isAbsolute(manifestPath) ||
    !manifestPath.endsWith(".ffconcat") || manifestPath.includes("..")) {
    throw new Error("Manifeste temporaire RTSP invalide.");
  }
  const stat = fs.lstatSync(manifestPath);
  if (!stat.isFile() || stat.isSymbolicLink() ||
    (process.platform !== "win32" && (stat.mode & 0o077) !== 0)) {
    throw new Error("Manifeste RTSP temporaire non sûr.");
  }
  return [
    "-protocol_whitelist", "file,concat,rtsp,rtsps,tcp,udp,tls,crypto",
    "-f", "concat", "-safe", "0", "-i", manifestPath,
  ];
}

function validateLocalRtspSource(value) {
  if (typeof value !== "string" || value.length < 12 || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("URI caméra invalide.");
  }
  let url;
  try { url = new URL(value); } catch { throw new Error("URI caméra invalide."); }
  if (!["rtsp:", "rtsps:"].includes(url.protocol) || url.hash) throw new Error("Source caméra RTSP/RTSPS locale requise.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const ipVersion = net.isIP(host);
  let local = false;
  if (ipVersion === 4) {
    const octets = host.split(".").map(Number);
    local = octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 169 && octets[1] === 254);
  } else if (ipVersion === 6) {
    local = host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
  } else {
    local = host.endsWith(".local") || host.endsWith(".lan") || host.endsWith(".home.arpa");
  }
  if (!local || !host || host === "localhost") throw new Error("La caméra doit être sur une IP privée ou un DNS local.");
  return url;
}

function validateRecordingPolicy(policy, allowedCameraIds) {
  const allowed = new Set(allowedCameraIds);
  if (!policy || typeof policy !== "object" || policy.version !== 1 ||
    !Array.isArray(policy.cameras) || policy.cameras.length > 64) {
    throw new Error("Politique d'enregistrement invalide.");
  }
  const seen = new Set();
  const cameras = policy.cameras.map((item) => {
    if (!item || !CAMERA_UUID.test(item.cameraId) || !allowed.has(item.cameraId)) {
      throw new Error("Caméra non configurée pour cet enregistreur.");
    }
    if (seen.has(item.cameraId)) throw new Error("Caméra dupliquée dans la politique.");
    seen.add(item.cameraId);
    if (item.enabled !== true) throw new Error("Seules les politiques activées doivent être enregistrées.");
    if (!Number.isInteger(item.segmentSeconds) ||
      item.segmentSeconds < MIN_SEGMENT_SECONDS || item.segmentSeconds > MAX_SEGMENT_SECONDS) {
      throw new Error("Durée de segment hors limites.");
    }
    if (!Number.isInteger(item.retentionDays) ||
      item.retentionDays < MIN_RETENTION_DAYS || item.retentionDays > MAX_RETENTION_DAYS) {
      throw new Error("Rétention hors limites.");
    }
    if (!Number.isSafeInteger(item.maxBytes) ||
      item.maxBytes < MIN_QUOTA_BYTES || item.maxBytes > MAX_QUOTA_BYTES) {
      throw new Error("Quota local hors limites.");
    }
    return {
      cameraId: item.cameraId,
      enabled: true,
      mode: "continuous",
      segmentSeconds: item.segmentSeconds,
      retentionDays: item.retentionDays,
      maxBytes: item.maxBytes,
    };
  });
  return { version: 1, cameras };
}

function readRecordingPolicy(stateDir, allowedCameraIds) {
  const filePath = path.join(stateDir, RECORDING_POLICY_FILE);
  if (!fs.existsSync(filePath)) return [];
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Fichier de politique local non sûr.");
  if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) {
    throw new Error("Permissions de la politique d'enregistrement trop ouvertes.");
  }
  const policy = validateRecordingPolicy(JSON.parse(fs.readFileSync(filePath, "utf8")), allowedCameraIds);
  return policy.cameras;
}

function writeRecordingPolicy(stateDir, policy, allowedCameraIds) {
  const normalized = validateRecordingPolicy(policy, allowedCameraIds);
  ensurePrivateDirectory(stateDir);
  writePrivateFile(path.join(stateDir, RECORDING_POLICY_FILE), JSON.stringify(normalized) + "\n");
  return normalized;
}

function recordingCameraDirectory(recordingRoot, cameraId) {
  if (!CAMERA_UUID.test(cameraId)) throw new Error("Identifiant caméra invalide.");
  const root = path.resolve(recordingRoot);
  ensurePrivateDirectory(root);
  const cameraDirectory = path.resolve(root, cameraId);
  if (!cameraDirectory.startsWith(root + path.sep)) throw new Error("Chemin caméra hors du volume local.");
  ensurePrivateDirectory(cameraDirectory);
  return cameraDirectory;
}

function buildRecordingOutputPattern(recordingRoot, cameraId) {
  const cameraDirectory = recordingCameraDirectory(recordingRoot, cameraId);
  return path.join(cameraDirectory, cameraId + "_%Y%m%dT%H%M%S.mp4");
}

function buildRecordingFfmpegArgs(manifestPath, outputPattern, segmentSeconds) {
  const inputArgs = buildFfmpegInputArgs(manifestPath);
  if (typeof outputPattern !== "string" || !outputPattern.endsWith("_%Y%m%dT%H%M%S.mp4") ||
    outputPattern.includes("..") || !path.isAbsolute(outputPattern)) {
    throw new Error("Motif local de segments invalide.");
  }
  if (!Number.isInteger(segmentSeconds) ||
    segmentSeconds < MIN_SEGMENT_SECONDS || segmentSeconds > MAX_SEGMENT_SECONDS) {
    throw new Error("Durée de segment hors limites.");
  }
  return [
    "-hide_banner", "-nostdin", "-loglevel", "error",
    ...inputArgs,
    "-map", "0:v:0", "-an", "-c:v", "copy",
    "-f", "segment", "-segment_time", String(segmentSeconds),
    "-segment_atclocktime", "1", "-reset_timestamps", "1",
    "-strftime", "1", "-segment_format", "mp4",
    "-segment_format_options", "movflags=+frag_keyframe+empty_moov+default_base_moof",
    outputPattern,
  ];
}

function startFfmpegRecorder({ sourceUrl, outputPattern, segmentSeconds, signal, spawnImpl = spawn }) {
  return new Promise((resolve) => {
    let child;
    let manifest;
    let finished = false;
    let killTimer = null;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      signal.removeEventListener("abort", onAbort);
      if (killTimer) clearTimeout(killTimer);
      let cleanupError = null;
      try { if (manifest) manifest.cleanup(); }
      catch { cleanupError = "MANIFEST_CLEANUP_FAILED"; }
      resolve(cleanupError ? { ...result, cleanupError } : result);
    };
    const onAbort = () => {
      if (child && child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
        killTimer = setTimeout(() => {
          if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        }, 10000);
        if (killTimer.unref) killTimer.unref();
      } else {
        finish({ exitSignal: "aborted", code: null });
      }
    };
    if (signal.aborted) {
      finish({ exitSignal: "aborted", code: null });
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    let args;
    try {
      if (signal.aborted) { finish({ exitSignal: "aborted", code: null }); return; }
      manifest = createPrivateRtspManifest(sourceUrl);
      args = buildRecordingFfmpegArgs(manifest.path, outputPattern, segmentSeconds);
      child = spawnImpl(process.env.NAXA_FFMPEG_BIN || "ffmpeg", args, {
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "ignore", "ignore"],
        env: { ...process.env, TZ: "UTC" },
      });
    } catch {
      finish({ code: null, spawnError: "SPAWN_FAILED" });
      return;
    }
    child.once("error", (error) => finish({
      code: null,
      spawnError: error && error.code === "ENOENT" ? "FFMPEG_MISSING" : "SPAWN_FAILED",
    }));
    child.once("exit", (code, exitSignal) => finish({ code, exitSignal }));
  });
}

function pruneRecordingFiles(recordingRoot, cameraId, {
  retentionDays,
  maxBytes,
  segmentSeconds,
  protectedPaths = [],
  nowMs = Date.now(),
} = {}) {
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > MAX_RETENTION_DAYS ||
    !Number.isSafeInteger(maxBytes) || maxBytes < MIN_QUOTA_BYTES || maxBytes > MAX_QUOTA_BYTES ||
    !Number.isInteger(segmentSeconds) || segmentSeconds < MIN_SEGMENT_SECONDS || segmentSeconds > MAX_SEGMENT_SECONDS) {
    throw new Error("Politique de rétention locale invalide.");
  }
  const directory = recordingCameraDirectory(recordingRoot, cameraId);
  const protectedSet = new Set(protectedPaths.map((item) => path.resolve(directory, item)));
  const activeWindowMs = Math.max(60000, segmentSeconds * 2000 + 30000);
  const files = [];
  for (const name of fs.readdirSync(directory)) {
    if (!name.endsWith(".mp4") || name.includes("/") || name.includes("\\")) continue;
    const filePath = path.join(directory, name);
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) continue;
    files.push({ filePath, size: stat.size, mtimeMs: stat.mtimeMs, protected: protectedSet.has(path.resolve(filePath)) });
  }
  let totalBytes = files.reduce((sum, item) => sum + item.size, 0);
  const cutoff = nowMs - retentionDays * 24 * 60 * 60 * 1000;
  const eligible = files.filter((item) => !item.protected && nowMs - item.mtimeMs > activeWindowMs)
    .sort((a, b) => a.mtimeMs - b.mtimeMs);
  const removed = [];
  for (const item of eligible) {
    const expired = item.mtimeMs < cutoff;
    const overQuota = totalBytes > maxBytes;
    if (!expired && !overQuota) continue;
    try {
      fs.unlinkSync(item.filePath);
      totalBytes -= item.size;
      removed.push(path.relative(directory, item.filePath));
    } catch {
      // Une erreur de suppression n'est jamais transformée en réussite de rétention.
    }
  }
  return { totalBytes, maxBytes, removed, protectedCount: files.filter((item) => item.protected).length };
}

async function waitDelay(ms, signal) {
  if (signal.aborted) return;
  await new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() { signal.removeEventListener("abort", onAbort); resolve(); }
    function onAbort() { clearTimeout(timer); done(); }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function runCameraRecorder({ camera, policy, stateDir, signal, log = (message) => console.error(message) }) {
  const recordingRoot = path.join(stateDir, RECORDING_DIRECTORY);
  const outputPattern = buildRecordingOutputPattern(recordingRoot, camera.cameraId);
  let backoffMs = 5000;
  while (!signal.aborted) {
    const maintenance = setInterval(() => {
      try {
        pruneRecordingFiles(recordingRoot, camera.cameraId, policy);
      } catch (error) {
        log("NAXA Security : rétention locale indisponible (" +
          (error instanceof Error ? error.message.slice(0, 80) : "erreur") + ").");
      }
    }, 15 * 60 * 1000);
    let result;
    try {
      result = await startFfmpegRecorder({
        sourceUrl: camera.sourceUrl,
        outputPattern,
        segmentSeconds: policy.segmentSeconds,
        signal,
      });
    } finally {
      clearInterval(maintenance);
    }
    if (signal.aborted) break;
    if (result?.spawnError === "FFMPEG_MISSING") {
      log("NAXA Security : FFmpeg absent sur la passerelle ; enregistrement local arrêté.");
      backoffMs = 300000;
    } else {
      try { pruneRecordingFiles(recordingRoot, camera.cameraId, policy); } catch {}
      backoffMs = Math.min(300000, Math.max(5000, backoffMs * 2));
      log("NAXA Security : enregistrement local interrompu ; reprise planifiée.");
    }
    await waitDelay(backoffMs, signal);
  }
}

module.exports = {
  RECORDING_POLICY_FILE,
  RECORDING_DIRECTORY,
  validateRecordingPolicy,
  readRecordingPolicy,
  writeRecordingPolicy,
  buildRecordingOutputPattern,
  createPrivateRtspManifest,
  buildFfmpegInputArgs,
  buildRecordingFfmpegArgs,
  startFfmpegRecorder,
  pruneRecordingFiles,
  runCameraRecorder,
};

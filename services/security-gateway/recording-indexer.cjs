"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { RECORDING_DIRECTORY } = require("./recording.cjs");

const CAMERA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEGMENT_NAME = /^([0-9a-f-]{36})_([0-9]{8})T([0-9]{6})\.mp4$/i;
const MAX_OUTBOX_ENTRIES = 10000;
const MAX_PROBE_OUTPUT = 64 * 1024;
const MAX_BATCH_SIZE = 10;

function ensurePrivateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Dossier d'indexation local non sûr.");
  if (process.platform !== "win32") fs.chmodSync(directory, 0o700);
}

function writePrivateContent(filePath, content) {
  ensurePrivateDirectory(path.dirname(filePath));
  const temporaryPath = filePath + ".tmp-" + process.pid + "-" + crypto.randomBytes(6).toString("hex");
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
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

function readOrCreateIndexKey(stateDir, indexPath, outboxPath) {
  const keyPath = path.join(stateDir, "recording-index.key");
  if (!fs.existsSync(keyPath)) {
    if (fs.existsSync(indexPath) || fs.existsSync(outboxPath)) {
      throw new Error("Clé locale d'indexation absente ; récupération manuelle requise.");
    }
    writePrivateContent(keyPath, crypto.randomBytes(32).toString("hex") + "\n");
  }
  const stat = fs.lstatSync(keyPath);
  if (!stat.isFile() || stat.isSymbolicLink() ||
    (process.platform !== "win32" && (stat.mode & 0o077) !== 0)) {
    throw new Error("Clé locale d'indexation non sûre.");
  }
  const raw = fs.readFileSync(keyPath, "utf8").trim();
  if (!/^[0-9a-f]{64}$/.test(raw)) throw new Error("Clé locale d'indexation invalide.");
  return Buffer.from(raw, "hex");
}

function writeEncryptedJson(filePath, value, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const envelope = {
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
  writePrivateContent(filePath, JSON.stringify(envelope) + "\n");
}

function readEncryptedJson(filePath, fallback, key) {
  if (!fs.existsSync(filePath)) return fallback;
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() ||
    (process.platform !== "win32" && (stat.mode & 0o077) !== 0)) {
    throw new Error("Fichier chiffré d'indexation local non sûr.");
  }
  try {
    const envelope = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!envelope || envelope.version !== 1 || envelope.algorithm !== "aes-256-gcm" ||
      typeof envelope.iv !== "string" || typeof envelope.tag !== "string" ||
      typeof envelope.ciphertext !== "string") throw new Error("INVALID_ENVELOPE");
    const iv = Buffer.from(envelope.iv, "base64");
    const tag = Buffer.from(envelope.tag, "base64");
    const ciphertext = Buffer.from(envelope.ciphertext, "base64");
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length > 12 * 1024 * 1024) {
      throw new Error("INVALID_ENVELOPE_SIZE");
    }
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8"));
  } catch {
    throw new Error("Fichier local d'indexation chiffré illisible ou altéré.");
  }
}

function parseSegmentName(fileName, expectedCameraId) {
  const match = SEGMENT_NAME.exec(fileName);
  if (!match || !CAMERA_UUID.test(match[1]) ||
    match[1].toLowerCase() !== expectedCameraId.toLowerCase()) return null;
  const [, cameraId, datePart, timePart] = match;
  const year = Number(datePart.slice(0, 4));
  const month = Number(datePart.slice(4, 6));
  const day = Number(datePart.slice(6, 8));
  const hour = Number(timePart.slice(0, 2));
  const minute = Number(timePart.slice(2, 4));
  const second = Number(timePart.slice(4, 6));
  const startedMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(startedMs);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day || check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute || check.getUTCSeconds() !== second) return null;
  return { cameraId, startedAt: new Date(startedMs).toISOString(), startedMs };
}

function runFfprobe(filePath, {
  binary = process.env.NAXA_FFPROBE_BIN || "ffprobe",
  spawnImpl = spawn,
  timeoutMs = 15000,
} = {}) {
  return new Promise((resolve, reject) => {
    const args = [
      "-v", "error",
      "-protocol_whitelist", "file,crypto,data",
      "-show_entries", "format=duration:stream=codec_type,codec_name",
      "-of", "json",
      filePath,
    ];
    let child;
    let output = "";
    let finished = false;
    let timeout;
    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      if (timeout) clearTimeout(timeout);
      if (child) {
        child.stdout?.removeAllListeners("data");
        child.removeAllListeners("error");
        child.removeAllListeners("exit");
      }
      if (error) reject(error);
      else resolve(result);
    };
    try {
      child = spawnImpl(binary, args, {
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      finish(new Error("FFPROBE_START_FAILED"));
      return;
    }
    timeout = setTimeout(() => {
      if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      finish(new Error("FFPROBE_TIMEOUT"));
    }, timeoutMs);
    if (timeout.unref) timeout.unref();
    child.stdout.on("data", (chunk) => {
      output += chunk.toString("utf8");
      if (Buffer.byteLength(output, "utf8") > MAX_PROBE_OUTPUT) {
        child.kill("SIGKILL");
        finish(new Error("FFPROBE_OUTPUT_TOO_LARGE"));
      }
    });
    child.once("error", (error) => finish(new Error(error?.code === "ENOENT" ? "FFPROBE_MISSING" : "FFPROBE_FAILED")));
    child.once("exit", (code) => {
      if (code !== 0) {
        finish(new Error("FFPROBE_FAILED"));
        return;
      }
      try {
        const probe = JSON.parse(output);
        const streams = Array.isArray(probe.streams) ? probe.streams : [];
        const video = streams.find((stream) => stream?.codec_type === "video" &&
          typeof stream.codec_name === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(stream.codec_name));
        if (!video || streams.some((stream) => stream?.codec_type === "audio")) {
          throw new Error("VIDEO_ONLY_SEGMENT_REQUIRED");
        }
        const durationSeconds = Number(probe.format?.duration);
        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 960) {
          throw new Error("SEGMENT_DURATION_INVALID");
        }
        finish(null, { codec: video.codec_name, durationSeconds });
      } catch (error) {
        finish(error instanceof Error ? error : new Error("FFPROBE_INVALID_OUTPUT"));
      }
    });
  });
}

function hashLocalFile(filePath) {
  const statBefore = fs.lstatSync(filePath);
  if (!statBefore.isFile() || statBefore.isSymbolicLink() || statBefore.size <= 0) {
    throw new Error("SEGMENT_FILE_NOT_REGULAR");
  }
  const noFollow = fs.constants.O_NOFOLLOW || 0;
  const descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | noFollow);
  const hash = crypto.createHash("sha256");
  let sizeBytes = 0;
  try {
    const buffer = Buffer.allocUnsafe(256 * 1024);
    let bytesRead;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) {
        hash.update(buffer.subarray(0, bytesRead));
        sizeBytes += bytesRead;
      }
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  const statAfter = fs.lstatSync(filePath);
  if (!statAfter.isFile() || statAfter.isSymbolicLink() ||
    statAfter.dev !== statBefore.dev || statAfter.ino !== statBefore.ino ||
    statAfter.size !== statBefore.size || statAfter.mtimeMs !== statBefore.mtimeMs ||
    sizeBytes !== statBefore.size) {
    throw new Error("SEGMENT_CHANGED_DURING_INDEX");
  }
  return { sha256: hash.digest("hex"), sizeBytes };
}

function loadState(stateDir, cameraId, key) {
  const indexPath = path.join(stateDir, "recording-index-" + cameraId + ".enc");
  const outboxPath = path.join(stateDir, "recording-outbox-" + cameraId + ".enc");
  const index = readEncryptedJson(indexPath, { version: 1, indexed: {} }, key);
  const outbox = readEncryptedJson(outboxPath, { version: 1, segments: [] }, key);
  if (!index || index.version !== 1 || !index.indexed || typeof index.indexed !== "object" ||
    Array.isArray(index.indexed) || !outbox || outbox.version !== 1 ||
    !Array.isArray(outbox.segments) || outbox.segments.length > MAX_OUTBOX_ENTRIES) {
    throw new Error("État local d'indexation invalide.");
  }
  const expectedCameraId = path.basename(outboxPath).slice("recording-outbox-".length, -".json".length);
  if (!CAMERA_UUID.test(expectedCameraId) || !outbox.segments.every((row) => validateQueuedRow(row, expectedCameraId))) {
    throw new Error("File de segments en attente invalide.");
  }
  for (const [relativePath, hash] of Object.entries(index.indexed)) {
    if (typeof relativePath !== "string" || typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)) {
      throw new Error("Index local de segments invalide.");
    }
  }
  return { indexPath, outboxPath, index, outbox };
}

function validateQueuedRow(row, cameraId) {
  if (!row || row.camera_id !== cameraId ||
    typeof row.storage_path !== "string" ||
    !row.storage_path.startsWith(cameraId + "/") ||
    !/^[0-9a-f]{64}$/.test(row.sha256) ||
    row.audio_enabled !== false || row.container_format !== "mp4" ||
    !["continuous", "scheduled", "event"].includes(row.recording_mode) ||
    typeof row.duration_seconds !== "number" || row.duration_seconds <= 0 || row.duration_seconds > 960 ||
    typeof row.codec !== "string" || !/^[A-Za-z0-9_.-]{1,64}$/.test(row.codec) ||
    !Number.isSafeInteger(row.size_bytes) || row.size_bytes <= 0) return false;
  const fileName = path.basename(row.storage_path);
  const parsed = parseSegmentName(fileName, cameraId);
  return Boolean(parsed) && path.dirname(row.storage_path) === cameraId &&
    typeof row.started_at === "string" && Number.isFinite(Date.parse(row.started_at)) &&
    typeof row.ended_at === "string" && Number.isFinite(Date.parse(row.ended_at)) &&
    Date.parse(row.ended_at) >= Date.parse(row.started_at) &&
    typeof row.retention_until === "string" && Number.isFinite(Date.parse(row.retention_until)) &&
    Date.parse(row.retention_until) >= Date.parse(row.started_at);
}

function createRecordingSegmentIndexer({
  stateDir,
  cameraId,
  policy,
  sendBatch,
  spawnImpl = spawn,
  ffprobeBinary,
  now = () => Date.now(),
  minFileAgeMs = 15000,
  log = (message) => console.error(message),
} = {}) {
  if (!CAMERA_UUID.test(cameraId) || typeof sendBatch !== "function") {
    throw new Error("Configuration d'indexeur de segments invalide.");
  }
  if (!Number.isInteger(policy?.retentionDays) || policy.retentionDays < 1 ||
    !Number.isInteger(policy?.segmentSeconds) || policy.segmentSeconds < 30 ||
    !Number.isInteger(policy?.maxBytes) || policy.maxBytes < 1024 * 1024 * 1024) {
    throw new Error("Politique de rétention/segment invalide pour l'indexeur.");
  }
  stateDir = path.resolve(stateDir);
  ensurePrivateDirectory(stateDir);
  const recordingRoot = path.join(stateDir, RECORDING_DIRECTORY);
  const cameraDirectory = path.join(recordingRoot, cameraId);
  ensurePrivateDirectory(recordingRoot);
  ensurePrivateDirectory(cameraDirectory);
  const indexPath = path.join(stateDir, "recording-index-" + cameraId + ".enc");
  const outboxPath = path.join(stateDir, "recording-outbox-" + cameraId + ".enc");
  const key = readOrCreateIndexKey(stateDir, indexPath, outboxPath);
  const state = loadState(stateDir, cameraId, key);
  let activeCycle = null;

  const saveState = () => {
    writeEncryptedJson(state.indexPath, state.index, key);
    writeEncryptedJson(state.outboxPath, state.outbox, key);
  };

  async function scan() {
    let queued = 0;
    for (const fileName of fs.readdirSync(cameraDirectory)) {
      const parsed = parseSegmentName(fileName, cameraId);
      if (!parsed) continue;
      const relativePath = cameraId + "/" + fileName;
      const filePath = path.join(cameraDirectory, fileName);
      let stat;
      try { stat = fs.lstatSync(filePath); } catch { continue; }
      if (!stat.isFile() || stat.isSymbolicLink() ||
        now() - stat.mtimeMs < minFileAgeMs || stat.size <= 0) continue;

      const knownHash = state.index.indexed[relativePath];
      const queuedRow = state.outbox.segments.find((row) => row.storage_path === relativePath);
      if (knownHash || queuedRow) continue;
      if (state.outbox.segments.length >= MAX_OUTBOX_ENTRIES) {
        log("NAXA Security : file de synchronisation pleine ; conservation locale maintenue.");
        break;
      }

      try {
        const metadata = await runFfprobe(filePath, {
          binary: ffprobeBinary || process.env.NAXA_FFPROBE_BIN || "ffprobe",
          spawnImpl,
        });
        const integrity = hashLocalFile(filePath);
        const statAfter = fs.lstatSync(filePath);
        if (!statAfter.isFile() || statAfter.isSymbolicLink() || statAfter.size !== integrity.sizeBytes) {
          throw new Error("SEGMENT_CHANGED_AFTER_PROBE");
        }
        const endedAtMs = parsed.startedMs + Math.round(metadata.durationSeconds * 1000);
        const row = {
          camera_id: cameraId,
          recording_mode: "continuous",
          started_at: parsed.startedAt,
          ended_at: new Date(endedAtMs).toISOString(),
          duration_seconds: Number(metadata.durationSeconds.toFixed(3)),
          codec: metadata.codec,
          container_format: "mp4",
          storage_path: relativePath,
          size_bytes: integrity.sizeBytes,
          sha256: integrity.sha256,
          audio_enabled: false,
          retention_until: new Date(parsed.startedMs + policy.retentionDays * 86400000).toISOString(),
        };
        if (!validateQueuedRow(row, cameraId)) throw new Error("SEGMENT_METADATA_INVALID");
        state.outbox.segments.push(row);
        writeEncryptedJson(state.outboxPath, state.outbox, key);
        queued += 1;
      } catch (error) {
        log("NAXA Security : segment local non indexé (" +
          (error instanceof Error ? error.message.slice(0, 80) : "erreur") + ").");
      }
    }
    return queued;
  }

  async function flush() {
    let sent = 0;
    while (state.outbox.segments.length > 0) {
      const batch = state.outbox.segments.slice(0, MAX_BATCH_SIZE);
      await sendBatch(batch);
      for (const row of batch) state.index.indexed[row.storage_path] = row.sha256;
      writeEncryptedJson(state.indexPath, state.index, key);
      state.outbox.segments.splice(0, batch.length);
      writeEncryptedJson(state.outboxPath, state.outbox, key);
      sent += batch.length;
    }
    return sent;
  }

  function runCycle() {
    if (activeCycle) return activeCycle;
    activeCycle = (async () => {
      const queued = await scan();
      let sent = 0;
      try { sent = await flush(); }
      catch (error) {
        log("NAXA Security : synchronisation des index en attente (" +
          (error instanceof Error ? error.message.slice(0, 80) : "erreur réseau") + ").");
      }
      return { queued, sent, pending: state.outbox.segments.length };
    })().finally(() => { activeCycle = null; });
    return activeCycle;
  }

  function getPendingPaths() {
    return state.outbox.segments.map((row) => path.basename(row.storage_path));
  }

  function forgetRemoved(relativePaths) {
    for (const relativePath of relativePaths) delete state.index.indexed[cameraId + "/" + relativePath];
    writeEncryptedJson(state.indexPath, state.index, key);
  }

  return { scan, flush, runCycle, getPendingPaths, forgetRemoved };
}

module.exports = {
  MAX_OUTBOX_ENTRIES,
  MAX_BATCH_SIZE,
  readOrCreateIndexKey,
  writeEncryptedJson,
  readEncryptedJson,
  parseSegmentName,
  runFfprobe,
  hashLocalFile,
  createRecordingSegmentIndexer,
};

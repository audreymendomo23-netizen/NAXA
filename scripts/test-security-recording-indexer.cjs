const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const {
  parseSegmentName,
  hashLocalFile,
  createRecordingSegmentIndexer,
} = require("../services/security-gateway/recording-indexer.cjs");

const CAMERA = "a4a4b1a1-4d0d-4b83-8db4-ae7c1b19ea20";
const POLICY = {
  segmentSeconds: 300,
  retentionDays: 30,
  maxBytes: 5 * 1024 * 1024 * 1024,
};

function fakeProbeSpawn({ withAudio = false } = {}) {
  return (_binary, args) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.exitCode = null;
    child.signalCode = null;
    child.kill = () => {};
    assert.ok(args.includes("-show_entries"));
    assert.ok(args[args.length - 1].endsWith(".mp4"));
    const streams = [{ codec_type: "video", codec_name: "h264" }];
    if (withAudio) streams.push({ codec_type: "audio", codec_name: "aac" });
    setImmediate(() => {
      child.stdout.emit("data", Buffer.from(JSON.stringify({
        streams,
        format: { duration: "300.000" },
      })));
      child.exitCode = 0;
      child.emit("exit", 0, null);
    });
    return child;
  };
}

function makeRecording(root, fileName, content = "video-segment-bytes") {
  const directory = path.join(root, "recordings", CAMERA);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const filePath = path.join(directory, fileName);
  fs.writeFileSync(filePath, content, { mode: 0o600 });
  const old = new Date(Date.now() - 60000);
  fs.utimesSync(filePath, old, old);
  return filePath;
}

test("lot 13 : parser de nom de segment conserve la date UTC et le périmètre caméra", () => {
  const parsed = parseSegmentName(CAMERA + "_20261109T103000.mp4", CAMERA);
  assert.ok(parsed);
  assert.equal(parsed.startedAt, "2026-11-09T10:30:00.000Z");
  assert.equal(parseSegmentName(CAMERA + "_20260230T103000.mp4", CAMERA), null);
  assert.equal(parseSegmentName(CAMERA + "_20261109T103000.mp4", "b4b4b1b1-4d0d-4b83-8db4-ae7c1b19ea21"), null);
  assert.equal(parseSegmentName("../escape.mp4", CAMERA), null);
});

test("lot 13 : SHA-256 local ne lit que des fichiers réguliers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "naxa-indexer-hash-"));
  try {
    const file = path.join(root, "segment.mp4");
    fs.writeFileSync(file, "sample");
    const result = hashLocalFile(file);
    assert.equal(result.sizeBytes, 6);
    assert.equal(result.sha256, require("node:crypto").createHash("sha256").update("sample").digest("hex"));
    const symlink = path.join(root, "link.mp4");
    fs.symlinkSync(file, symlink);
    assert.throws(() => hashLocalFile(symlink), /SEGMENT_FILE_NOT_REGULAR/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("lot 13 : indexe le MP4 local, calcule hash/codec puis garde la file si le WAN échoue", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "naxa-indexer-offline-"));
  const fileName = CAMERA + "_20261109T103000.mp4";
  try {
    const filePath = makeRecording(root, fileName);
    let attempts = 0;
    const logs = [];
    const indexer = createRecordingSegmentIndexer({
      stateDir: root,
      cameraId: CAMERA,
      policy: POLICY,
      minFileAgeMs: 0,
      spawnImpl: fakeProbeSpawn(),
      log: message => logs.push(message),
      sendBatch: async batch => {
        attempts += 1;
        assert.equal(batch.length, 1);
        assert.equal(batch[0].camera_id, CAMERA);
        assert.equal(batch[0].codec, "h264");
        assert.equal(batch[0].audio_enabled, false);
        assert.equal(batch[0].storage_path, CAMERA + "/" + fileName);
        assert.equal(batch[0].sha256, hashLocalFile(filePath).sha256);
        if (attempts === 1) throw new Error("network unavailable");
        return 1;
      },
    });

    const offline = await indexer.runCycle();
    assert.deepEqual(offline, { queued: 1, sent: 0, pending: 1 });
    const outboxPath = path.join(root, "recording-outbox-" + CAMERA + ".json");
    assert.equal(JSON.parse(fs.readFileSync(outboxPath, "utf8")).segments.length, 1);
    if (process.platform !== "win32") assert.equal(fs.statSync(outboxPath).mode & 0o777, 0o600);

    const restored = await indexer.runCycle();
    assert.deepEqual(restored, { queued: 0, sent: 1, pending: 0 });
    const indexPath = path.join(root, "recording-index-" + CAMERA + ".json");
    assert.ok(JSON.parse(fs.readFileSync(indexPath, "utf8")).indexed[CAMERA + "/" + fileName]);
    assert.equal(JSON.parse(fs.readFileSync(outboxPath, "utf8")).segments.length, 0);
    assert.deepEqual(await indexer.runCycle(), { queued: 0, sent: 0, pending: 0 });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("lot 13 : refuse un segment qui contient une piste audio", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "naxa-indexer-audio-"));
  try {
    makeRecording(root, CAMERA + "_20261109T103000.mp4");
    const logs = [];
    const indexer = createRecordingSegmentIndexer({
      stateDir: root,
      cameraId: CAMERA,
      policy: POLICY,
      minFileAgeMs: 0,
      spawnImpl: fakeProbeSpawn({ withAudio: true }),
      log: message => logs.push(message),
      sendBatch: async () => { throw new Error("must not send"); },
    });
    const result = await indexer.runCycle();
    assert.deepEqual(result, { queued: 0, sent: 0, pending: 0 });
    assert.ok(logs.some(line => line.includes("VIDEO_ONLY_SEGMENT_REQUIRED")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("lot 13 : les chemins d'index en attente protègent les segments contre la rétention", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "naxa-indexer-protect-"));
  try {
    makeRecording(root, CAMERA + "_20261109T103000.mp4");
    const indexer = createRecordingSegmentIndexer({
      stateDir: root,
      cameraId: CAMERA,
      policy: POLICY,
      minFileAgeMs: 0,
      spawnImpl: fakeProbeSpawn(),
      sendBatch: async () => { throw new Error("offline"); },
      log: () => {},
    });
    await indexer.runCycle();
    assert.deepEqual(indexer.getPendingPaths(), [CAMERA + "_20261109T103000.mp4"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

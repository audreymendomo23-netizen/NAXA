const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  validateRecordingPolicy,
  readRecordingPolicy,
  writeRecordingPolicy,
  buildRecordingOutputPattern,
  createPrivateRtspManifest,
  buildRecordingFfmpegArgs,
  startFfmpegRecorder,
  pruneRecordingFiles,
} = require("../services/security-gateway/recording.cjs");

const CAMERA_A = "a4a4b1a1-4d0d-4b83-8db4-ae7c1b19ea20";
const CAMERA_B = "b4b4b1b1-4d0d-4b83-8db4-ae7c1b19ea21";
const SOURCE = "rtsp://operator:secret@192.168.1.20:554/stream";

function validPolicy() {
  return {
    version: 1,
    cameras: [{
      cameraId: CAMERA_A,
      enabled: true,
      segmentSeconds: 300,
      retentionDays: 30,
      maxBytes: 5 * 1024 * 1024 * 1024,
    }],
  };
}

test("lot 13 : politique locale continue bornée aux caméras déjà configurées", () => {
  const policy = validateRecordingPolicy(validPolicy(), [CAMERA_A]);
  assert.equal(policy.cameras[0].mode, "continuous");
  assert.throws(() => validateRecordingPolicy(validPolicy(), [CAMERA_B]), /non configurée/);
  assert.throws(() => validateRecordingPolicy({
    ...validPolicy(),
    cameras: [{ ...validPolicy().cameras[0], segmentSeconds: 10 }],
  }, [CAMERA_A]), /Durée de segment/);
  assert.throws(() => validateRecordingPolicy({
    ...validPolicy(),
    cameras: [{ ...validPolicy().cameras[0], retentionDays: 0 }],
  }, [CAMERA_A]), /Rétention/);
});

test("lot 13 : politique enregistrée atomiquement avec permissions privées et défaut désactivé", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "naxa-recording-policy-"));
  try {
    assert.deepEqual(readRecordingPolicy(root, [CAMERA_A]), []);
    writeRecordingPolicy(root, validPolicy(), [CAMERA_A]);
    assert.equal(readRecordingPolicy(root, [CAMERA_A]).length, 1);
    if (process.platform !== "win32") {
      assert.equal(fs.statSync(path.join(root, "recording-policy.json")).mode & 0o777, 0o600);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("lot 13 : sortie segmentée locale UTC, conteneur MP4 et audio désactivé", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "naxa-recording-output-"));
  try {
    const pattern = buildRecordingOutputPattern(root, CAMERA_A);
    assert.ok(pattern.startsWith(path.join(root, CAMERA_A)));
    assert.ok(pattern.endsWith("_%Y%m%dT%H%M%S.mp4"));
    const manifest = createPrivateRtspManifest(SOURCE);
    try {
      const args = buildRecordingFfmpegArgs(manifest.path, pattern, 300);
      const manifestContent = fs.readFileSync(manifest.path, "utf8");
      assert.ok(manifestContent.includes("rtsp://operator:secret@192.168.1.20:554/stream"));
      assert.equal(args.join(" ").includes("operator:secret"), false);
      assert.ok(args.includes(manifest.path));
      if (process.platform !== "win32") {
        assert.equal(fs.statSync(manifest.path).mode & 0o777, 0o600);
      }
      assert.ok(args.includes("-f") && args[args.indexOf("-f") + 1] === "segment");
    assert.ok(args.includes("-segment_time") && args[args.indexOf("-segment_time") + 1] === "300");
    assert.ok(args.includes("-strftime") && args[args.indexOf("-strftime") + 1] === "1");
    assert.ok(args.includes("-an"));
    assert.ok(args.includes("copy"));
    assert.ok(args.includes("movflags=+frag_keyframe+empty_moov+default_base_moof"));
    assert.throws(() => buildRecordingFfmpegArgs(SOURCE, "/tmp/../escape_%Y%m%dT%H%M%S.mp4", 300));
      assert.throws(() => buildRecordingOutputPattern(root, "../../escape"));
    } finally {
      manifest.cleanup();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("lot 13 : arrêt déjà demandé interdit tout spawn FFmpeg", async () => {
  const controller = new AbortController();
  controller.abort();
  let spawned = false;
  const result = await startFfmpegRecorder({
    sourceUrl: SOURCE,
    outputPattern: "/tmp/camera_%Y%m%dT%H%M%S.mp4",
    segmentSeconds: 300,
    signal: controller.signal,
    spawnImpl: () => { spawned = true; throw new Error("must not spawn"); },
  });
  assert.equal(spawned, false);
  assert.equal(result.exitSignal, "aborted");
});

test("lot 13 : rétention ne supprime pas les segments protégés ou en cours", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "naxa-recording-retention-"));
  const now = Date.now();
  try {
    const pattern = buildRecordingOutputPattern(root, CAMERA_A);
    const directory = path.dirname(pattern);
    const old = path.join(directory, "old.mp4");
    const protectedFile = path.join(directory, "protected.mp4");
    const recent = path.join(directory, "active.mp4");
    fs.writeFileSync(old, "old segment");
    fs.writeFileSync(protectedFile, "protected segment");
    fs.writeFileSync(recent, "active segment");
    const oldTime = new Date(now - 3 * 24 * 60 * 60 * 1000);
    const recentTime = new Date(now - 1000);
    fs.utimesSync(old, oldTime, oldTime);
    fs.utimesSync(protectedFile, oldTime, oldTime);
    fs.utimesSync(recent, recentTime, recentTime);

    const result = pruneRecordingFiles(root, CAMERA_A, {
      retentionDays: 1,
      maxBytes: 5 * 1024 * 1024 * 1024,
      segmentSeconds: 300,
      protectedPaths: ["protected.mp4"],
      nowMs: now,
    });
    assert.deepEqual(result.removed, ["old.mp4"]);
    assert.equal(fs.existsSync(old), false);
    assert.equal(fs.existsSync(protectedFile), true);
    assert.equal(fs.existsSync(recent), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("lot 13 : agent systemd démarre l'enregistrement uniquement sur politique explicite", () => {
  const agent = fs.readFileSync(path.join(__dirname, "../services/security-gateway/agent.cjs"), "utf8");
  assert.ok(agent.includes('command === "configure-recording"'));
  assert.ok(agent.includes('flags["policy-stdin"]'));
  assert.ok(agent.includes("readRecordingPolicy(stateDir"));
  assert.ok(agent.includes("runCameraRecorder"));
  assert.ok(agent.includes("recordingWorkers"));
  assert.ok(agent.includes("Audio désactivé"));
});

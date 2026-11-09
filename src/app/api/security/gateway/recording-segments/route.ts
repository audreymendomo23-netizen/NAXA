import { NextResponse } from "next/server";
import { authenticateSignedSecurityGateway } from "@/lib/security/gateway-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const codecPattern = /^[A-Za-z0-9_.-]{1,64}$/;
const hashPattern = /^[0-9a-f]{64}$/;
const pathPattern = /^([0-9a-f-]{36})\/\1_[0-9]{8}T[0-9]{6}\.mp4$/i;
const maximumBatch = 10;

type SegmentInput = {
  cameraId?: unknown;
  recordingMode?: unknown;
  startedAt?: unknown;
  endedAt?: unknown;
  durationSeconds?: unknown;
  codec?: unknown;
  containerFormat?: unknown;
  storagePath?: unknown;
  sizeBytes?: unknown;
  sha256?: unknown;
  audioEnabled?: unknown;
  retentionUntil?: unknown;
};

type SegmentRow = {
  camera_id: string;
  recording_mode: "continuous" | "scheduled" | "event";
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  codec: string;
  container_format: "mp4";
  storage_path: string;
  size_bytes: number;
  sha256: string;
  audio_enabled: false;
  retention_until: string;
};

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, {
    status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
  });
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const normalized = new Date(timestamp).toISOString();
  return normalized;
}

function normalizeSegments(input: unknown): SegmentRow[] | null {
  if (!Array.isArray(input) || input.length < 1 || input.length > maximumBatch) return null;
  const rows: SegmentRow[] = [];
  const seen = new Map<string, string>();

  for (const candidate of input) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const s = candidate as SegmentInput;
    const cameraId = typeof s.cameraId === "string" ? s.cameraId : "";
    const recordingMode = s.recordingMode;
    const startedAt = parseTimestamp(s.startedAt);
    const endedAt = parseTimestamp(s.endedAt);
    const retentionUntil = parseTimestamp(s.retentionUntil);
    const durationSeconds = s.durationSeconds;
    const codec = typeof s.codec === "string" ? s.codec : "";
    const storagePath = typeof s.storagePath === "string" ? s.storagePath : "";
    const sizeBytes = s.sizeBytes;
    const sha256 = typeof s.sha256 === "string" ? s.sha256 : "";

    if (!uuid.test(cameraId) ||
      !["continuous", "scheduled", "event"].includes(String(recordingMode)) ||
      !startedAt || !endedAt || Date.parse(endedAt) < Date.parse(startedAt) ||
      typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds) ||
      durationSeconds <= 0 || durationSeconds > 960 ||
      !codecPattern.test(codec) ||
      s.containerFormat !== "mp4" ||
      !pathPattern.test(storagePath) ||
      storagePath.split("/").some(part => part === "." || part === "..") ||
      !Number.isSafeInteger(sizeBytes) || Number(sizeBytes) <= 0 ||
      !hashPattern.test(sha256) ||
      s.audioEnabled !== false ||
      !retentionUntil || Date.parse(retentionUntil) < Date.parse(startedAt)) {
      return null;
    }

    const match = pathPattern.exec(storagePath);
    if (!match || match[1].toLowerCase() !== cameraId.toLowerCase()) return null;
    const key = cameraId + "\n" + storagePath;
    const priorHash = seen.get(key);
    if (priorHash && priorHash !== sha256) return null;
    seen.set(key, sha256);

    rows.push({
      camera_id: cameraId,
      recording_mode: recordingMode as SegmentRow["recording_mode"],
      started_at: startedAt,
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      codec,
      container_format: "mp4",
      storage_path: storagePath,
      size_bytes: Number(sizeBytes),
      sha256,
      audio_enabled: false,
      retention_until: retentionUntil,
    });
  }
  return rows;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody || Buffer.byteLength(rawBody, "utf8") > 8192) {
      return fail(413, "Lot de segments absent ou trop volumineux.");
    }

    let body: { segments?: unknown };
    try { body = JSON.parse(rawBody); }
    catch { return fail(400, "JSON invalide."); }

    const segments = normalizeSegments(body.segments);
    if (!segments) return fail(400, "Métadonnées de segment invalides ou lot hors limites.");

    const auth = await authenticateSignedSecurityGateway(request, rawBody);
    if (!auth.ok) return fail(auth.status, auth.error);

    if (auth.installation.status !== "pilot_active" ||
      auth.installation.legal_review_status !== "approved" ||
      auth.installation.privacy_notice_status !== "approved") {
      return fail(403, "Installation non autorisée à synchroniser des archives.");
    }

    const cameraIds = [...new Set(segments.map(segment => segment.camera_id))];
    const { data: cameras, error: cameraError } = await auth.admin
      .from("naxa_security_cameras")
      .select("id,status")
      .eq("pharmacie_id", auth.gateway.pharmacie_id)
      .eq("gateway_id", auth.gateway.id)
      .in("id", cameraIds);

    if (cameraError) return fail(503, "Registre caméra indisponible.");
    const allowed = new Set(
      (cameras ?? [])
        .filter(camera => !["disabled", "retired"].includes(camera.status))
        .map(camera => camera.id),
    );
    if (cameraIds.some(cameraId => !allowed.has(cameraId))) {
      return fail(403, "Un segment référence une caméra hors du périmètre actif de la passerelle.");
    }

    const { data: inserted, error } = await auth.admin.rpc(
      "naxa_security_sync_recording_segments",
      {
        p_pharmacie_id: auth.gateway.pharmacie_id,
        p_gateway_id: auth.gateway.id,
        p_segments: segments,
      },
    );
    if (error || !Number.isSafeInteger(inserted) || Number(inserted) < 0 || Number(inserted) > segments.length) {
      console.error("[security.recording] metadata sync rejected", {
        code: error?.code ?? "INVALID_RESULT",
      });
      return fail(error?.code === "23505" ? 409 : 503, "Métadonnées non synchronisées.");
    }

    return NextResponse.json({
      ok: true,
      submittedSegments: segments.length,
      insertedSegments: Number(inserted),
    }, { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
  } catch {
    return fail(500, "Service de synchronisation des archives indisponible.");
  }
}

import { NextResponse } from "next/server";
import { authenticateSignedSecurityGateway } from "@/lib/security/gateway-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fingerprintPattern = /^[0-9a-f]{64}$/;
const eventTypes = new Set([
  "motion","intrusion","line_crossing","camera_tamper","camera_obstructed",
  "signal_lost","after_hours_presence","system_offline","other",
]);
const sourceTypes = new Set(["onvif","edge_ai","gateway"]);
const metadataKeys = new Set([
  "event_code","event_sequence","detector_id","detector_version",
  "zone_id","rule_id","channel","sensor_type",
]);

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, {
    status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
  });
}

function sanitizeMetadata(value: unknown): Record<string, string | number | boolean> | null {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 8) return null;
  const result: Record<string, string | number | boolean> = {};
  for (const [key, item] of entries) {
    if (!metadataKeys.has(key)) return null;
    if (typeof item === "string") {
      if (!item.trim() || item.length > 120 || /[\u0000-\u001f\u007f]/.test(item)) return null;
      result[key] = item.trim();
    } else if (typeof item === "number") {
      if (!Number.isSafeInteger(item) || item < 0) return null;
      result[key] = item;
    } else if (typeof item === "boolean") {
      result[key] = item;
    } else return null;
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody || Buffer.byteLength(rawBody, "utf8") > 8192) {
      return fail(413, "Rapport d’événement absent ou trop volumineux.");
    }

    let body: {
      cameraId?: unknown;
      eventType?: unknown;
      sourceType?: unknown;
      summary?: unknown;
      confidence?: unknown;
      detectedAt?: unknown;
      sourceFingerprint?: unknown;
      metadata?: unknown;
    };
    try { body = JSON.parse(rawBody); }
    catch { return fail(400, "JSON invalide."); }

    const cameraId = body.cameraId === null ? null :
      typeof body.cameraId === "string" ? body.cameraId : "";
    const eventType = typeof body.eventType === "string" ? body.eventType : "";
    const sourceType = typeof body.sourceType === "string" ? body.sourceType : "";
    const summary = typeof body.summary === "string" ? body.summary.trim() : "";
    const detectedAt = typeof body.detectedAt === "string" ? Date.parse(body.detectedAt) : NaN;
    const confidence = body.confidence === undefined || body.confidence === null ? null : body.confidence;
    const sourceFingerprint = typeof body.sourceFingerprint === "string" ? body.sourceFingerprint : "";
    const metadata = sanitizeMetadata(body.metadata);

    if (
      (cameraId !== null && (typeof cameraId !== "string" || !uuid.test(cameraId))) ||
      (cameraId === null && eventType !== "system_offline") ||
      !eventTypes.has(eventType) || !sourceTypes.has(sourceType) ||
      summary.length < 2 || summary.length > 280 ||
      /[\u0000-\u001f\u007f]/.test(summary) ||
      /rtsps?:\/\/|https?:\/\/|authorization|bearer |password\s*=/i.test(summary) ||
      !Number.isFinite(detectedAt) ||
      detectedAt < Date.now() - 7 * 24 * 60 * 60 * 1000 ||
      detectedAt > Date.now() + 2 * 60 * 1000 ||
      (confidence !== null && (typeof confidence !== "number" ||
        !Number.isFinite(confidence) || confidence < 0 || confidence > 1)) ||
      !fingerprintPattern.test(sourceFingerprint) || metadata === null
    ) {
      return fail(400, "Contenu d’événement invalide ou non autorisé.");
    }
    if ((sourceType === "onvif" || sourceType === "edge_ai") && cameraId === null) {
      return fail(400, "Une caméra est requise pour cette source d’événement.");
    }

    const auth = await authenticateSignedSecurityGateway(request, rawBody);
    if (!auth.ok) return fail(auth.status, auth.error);
    if (auth.installation.status !== "pilot_active" ||
      auth.installation.legal_review_status !== "approved" ||
      auth.installation.privacy_notice_status !== "approved") {
      return fail(403, "Installation non autorisée à transmettre des événements.");
    }

    if (cameraId !== null) {
      const { data: camera, error: cameraError } = await auth.admin
        .from("naxa_security_cameras").select("id,status")
        .eq("id", cameraId).eq("pharmacie_id", auth.gateway.pharmacie_id)
        .eq("gateway_id", auth.gateway.id).maybeSingle();
      if (cameraError) return fail(503, "Registre caméra indisponible.");
      if (!camera || ["disabled","retired"].includes(camera.status)) {
        return fail(404, "Caméra hors du périmètre de cette passerelle.");
      }
    }

    const { data: eventId, error } = await auth.admin.rpc("naxa_security_ingest_gateway_event", {
      p_pharmacie_id: auth.gateway.pharmacie_id,
      p_gateway_id: auth.gateway.id,
      p_camera_id: cameraId,
      p_event_type: eventType,
      p_source_type: sourceType,
      p_summary: summary,
      p_confidence: confidence,
      p_detected_at: new Date(detectedAt).toISOString(),
      p_source_fingerprint: sourceFingerprint,
      p_event_metadata: metadata,
    });
    if (error || typeof eventId !== "string" || !uuid.test(eventId)) {
      console.error("[security.events] ingest rejected", { code: error?.code ?? "INVALID_RESULT" });
      return fail(error?.code === "42501" ? 403 : 503, "Événement non enregistré.");
    }

    return NextResponse.json({ ok: true, eventId }, {
      headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
    });
  } catch {
    return fail(500, "Service d’événements momentanément indisponible.");
  }
}

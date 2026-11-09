import { NextResponse } from "next/server";
import { loadPromoteurAccess } from "@/lib/promoteur-access";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_WINDOW_DAYS = 31;
const MAX_ROWS = 100;

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, {
    status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
  });
}

function parseDate(value: string | null): string | null {
  if (!value || value.length > 40) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export async function GET(request: Request) {
  try {
    const access = await loadPromoteurAccess();
    if (access.profile.role !== "promoteur" || access.profile.actif !== true ||
      access.shouldShowAccessStatus || access.linksError || access.pharmaciesError) {
      return fail(403, "Accès Promoteur indisponible ou suspendu.");
    }
    const url = new URL(request.url);
    const pharmacyId = url.searchParams.get("pharmacieId");
    const cameraId = url.searchParams.get("cameraId");
    const fromRaw = url.searchParams.get("from");
    const toRaw = url.searchParams.get("to");
    const from = parseDate(fromRaw);
    const to = parseDate(toRaw);
    const now = Date.now();
    const defaultTo = new Date(now).toISOString();
    const defaultFrom = new Date(now - 7 * 86400000).toISOString();
    const start = from ?? defaultFrom;
    const end = to ?? defaultTo;
    if ((fromRaw && !from) || (toRaw && !to) || Date.parse(end) < Date.parse(start) ||
      Date.parse(end) - Date.parse(start) > MAX_WINDOW_DAYS * 86400000 ||
      (cameraId && !uuid.test(cameraId))) {
      return fail(400, "Période ou caméra invalide (31 jours maximum).");
    }

    const activePharmacies = (access.pharmacies ?? []).filter((item) =>
      access.activeLinkIds.has(item.id) && item.actif && item.visible_recherche && item.archivee_le === null
    );
    let pharmacyIds = activePharmacies.map((item) => item.id);
    if (pharmacyId) {
      if (!uuid.test(pharmacyId) || !pharmacyIds.includes(pharmacyId)) return fail(404, "Pharmacie hors périmètre.");
      pharmacyIds = [pharmacyId];
    }
    if (pharmacyIds.length === 0) return NextResponse.json({ ok: true, segments: [] }, {
      headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
    });

    const db = supabaseAdmin();
    let query = db.from("naxa_security_recording_segments")
      .select("id,pharmacie_id,camera_id,status,started_at,ended_at,duration_seconds,codec,container_format,size_bytes,sha256,protected_at,protected_reason", { count: "exact" })
      .in("pharmacie_id", pharmacyIds)
      .in("status", ["ready", "protected"])
      .gte("started_at", start)
      .lte("started_at", end)
      .order("started_at", { ascending: false })
      .limit(MAX_ROWS);
    if (cameraId) query = query.eq("camera_id", cameraId);
    const { data, error, count } = await query;
    if (error) return fail(503, "Index temporel indisponible.");

    const segments = data ?? [];
    if (segments.length > 0) {
      const auditRows = segments.map((segment) => ({
        pharmacie_id: segment.pharmacie_id,
        actor_id: access.profile.id,
        actor_role: "promoteur",
        action: "recording_segment_view",
        resource_type: "recording_segment",
        resource_id: segment.id,
        justification: "Consultation de la timeline des archives",
        audit_metadata: { camera_id: segment.camera_id, status: segment.status, started_at: segment.started_at },
      }));
      const { error: auditError } = await db.from("naxa_security_access_audit").insert(auditRows);
      if (auditError) return fail(503, "Journal d'accès indisponible ; archives non affichées.");
    }

    return NextResponse.json({
      ok: true,
      segments: segments.map((segment) => ({
        id: segment.id,
        pharmacieId: segment.pharmacie_id,
        cameraId: segment.camera_id,
        status: segment.status,
        startedAt: segment.started_at,
        endedAt: segment.ended_at,
        durationSeconds: segment.duration_seconds,
        codec: segment.codec,
        containerFormat: segment.container_format,
        sizeBytes: segment.size_bytes,
        sha256: segment.sha256,
        protectedAt: segment.protected_at,
        protectedReason: segment.protected_reason,
      })),
      truncated: (count ?? 0) > MAX_ROWS,
      limit: MAX_ROWS,
    }, { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
  } catch {
    return fail(500, "Service de timeline indisponible.");
  }
}

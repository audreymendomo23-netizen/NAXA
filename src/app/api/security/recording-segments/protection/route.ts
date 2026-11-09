import { NextResponse } from "next/server";
import { loadPromoteurAccess } from "@/lib/promoteur-access";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, {
    status,
    headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
  });
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return fail(403, "Origine refusée.");
    if (request.headers.get("sec-fetch-site") === "cross-site") return fail(403, "Origine refusée.");

    const rawBody = await request.text();
    if (!rawBody || Buffer.byteLength(rawBody, "utf8") > 2048) return fail(413, "Requête trop volumineuse.");
    let body: { segmentId?: unknown; protect?: unknown; reason?: unknown };
    try { body = JSON.parse(rawBody); } catch { return fail(400, "JSON invalide."); }

    const segmentId = typeof body.segmentId === "string" ? body.segmentId : "";
    const protect = body.protect;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!uuid.test(segmentId) || typeof protect !== "boolean" || reason.length < 8 || reason.length > 500) {
      return fail(400, "Segment, décision ou justification invalide.");
    }

    const access = await loadPromoteurAccess();
    if (access.profile.role !== "promoteur" || access.profile.actif !== true ||
      access.shouldShowAccessStatus || access.linksError || access.pharmaciesError) {
      return fail(403, "Accès Promoteur indisponible ou suspendu.");
    }

    const db = supabaseAdmin();
    const { data: segment, error: segmentError } = await db
      .from("naxa_security_recording_segments")
      .select("id,pharmacie_id,status")
      .eq("id", segmentId)
      .maybeSingle();
    if (segmentError) return fail(503, "Index d'archives indisponible.");
    if (!segment || !access.activeLinkIds.has(segment.pharmacie_id)) return fail(404, "Archive hors de votre périmètre.");
    const pharmacy = (access.pharmacies ?? []).find((item) =>
      item.id === segment.pharmacie_id && item.actif && item.visible_recherche && item.archivee_le === null
    );
    if (!pharmacy) return fail(403, "Pharmacie suspendue ou non publiée.");
    if (!["ready", "protected"].includes(segment.status)) return fail(409, "Archive non disponible pour cette opération.");

    const { data, error } = await db.rpc("naxa_security_set_recording_protection", {
      p_segment_id: segmentId,
      p_pharmacie_id: segment.pharmacie_id,
      p_actor_id: access.profile.id,
      p_actor_role: "promoteur",
      p_protected: protect,
      p_reason: reason,
    });
    if (error) {
      console.error("[security.recording.protection] operation rejected", { code: error.code });
      return fail(error.code === "P0002" ? 404 : 503, "Modification de la protection impossible.");
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || row.segment_id !== segmentId) return fail(503, "Résultat de protection indisponible.");

    return NextResponse.json({
      ok: true,
      segment: {
        id: row.segment_id,
        status: row.segment_status,
        protectedAt: row.segment_protected_at,
        protectedReason: row.segment_protected_reason,
      },
    }, { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
  } catch {
    return fail(500, "Service de protection des archives indisponible.");
  }
}

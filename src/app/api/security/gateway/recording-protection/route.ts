import { NextResponse } from "next/server";
import { authenticateSignedSecurityGateway } from "@/lib/security/gateway-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PROTECTED_ROWS = 10000;

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, complete: false, error }, {
    status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
  });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody || Buffer.byteLength(rawBody, "utf8") > 4096) return fail(413, "Requête trop volumineuse.");
    let body: { cameraIds?: unknown };
    try { body = JSON.parse(rawBody); } catch { return fail(400, "JSON invalide."); }
    if (!Array.isArray(body.cameraIds) || body.cameraIds.length < 1 || body.cameraIds.length > 64 ||
      body.cameraIds.some((id) => typeof id !== "string" || !uuid.test(id)) ||
      new Set(body.cameraIds).size !== body.cameraIds.length) {
      return fail(400, "Liste de caméras invalide.");
    }

    const auth = await authenticateSignedSecurityGateway(request, rawBody);
    if (!auth.ok) return fail(auth.status, auth.error);
    if (auth.installation.status !== "pilot_active" ||
      auth.installation.legal_review_status !== "approved" ||
      auth.installation.privacy_notice_status !== "approved") {
      return fail(403, "Installation non autorisée à synchroniser la protection des archives.");
    }

    const cameraIds = body.cameraIds as string[];
    const { data: cameras, error: cameraError } = await auth.admin
      .from("naxa_security_cameras")
      .select("id,status")
      .eq("pharmacie_id", auth.gateway.pharmacie_id)
      .eq("gateway_id", auth.gateway.id)
      .in("id", cameraIds);
    if (cameraError) return fail(503, "Registre caméra indisponible.");
    const eligible = new Set((cameras ?? [])
      .filter((camera) => !["disabled", "retired"].includes(camera.status))
      .map((camera) => camera.id));
    if (cameraIds.some((id) => !eligible.has(id))) return fail(403, "Caméra hors du périmètre actif de la passerelle.");

    const { data: rows, error: rowsError, count } = await auth.admin
      .from("naxa_security_recording_segments")
      .select("camera_id,storage_path", { count: "exact" })
      .eq("pharmacie_id", auth.gateway.pharmacie_id)
      .eq("gateway_id", auth.gateway.id)
      .eq("status", "protected")
      .in("camera_id", cameraIds)
      .limit(MAX_PROTECTED_ROWS + 1);
    if (rowsError || count === null || count === undefined) return fail(503, "Registre de protection indisponible.");
    if (count > MAX_PROTECTED_ROWS || (rows ?? []).length !== count) {
      return NextResponse.json({ ok: true, complete: false, protectedByCamera: {} }, {
        headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
      });
    }

    const protectedByCamera: Record<string, string[]> = Object.fromEntries(cameraIds.map((id) => [id, []]));
    for (const row of rows ?? []) {
      const cameraId = row.camera_id;
      const prefix = cameraId + "/";
      if (!protectedByCamera[cameraId] || typeof row.storage_path !== "string" ||
        !row.storage_path.startsWith(prefix) || row.storage_path.includes("..")) {
        return fail(503, "Registre de protection incohérent.");
      }
      const name = row.storage_path.slice(prefix.length);
      if (!new RegExp("^" + cameraId + "_[0-9]{8}T[0-9]{6}\\.mp4$").test(name)) {
        return fail(503, "Chemin protégé non conforme.");
      }
      protectedByCamera[cameraId].push(name);
    }

    return NextResponse.json({ ok: true, complete: true, protectedByCamera }, {
      headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
    });
  } catch {
    return fail(500, "Service de synchronisation des protections indisponible.");
  }
}

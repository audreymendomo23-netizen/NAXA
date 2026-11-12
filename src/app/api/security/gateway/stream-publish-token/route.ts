import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { authenticateSignedSecurityGateway } from "@/lib/security/gateway-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}
function publishOrigin(): URL | null {
  const value = process.env.NAXA_MEDIAMTX_RTSPS_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "rtsps:" || url.username || url.password ||
      url.search || url.hash || url.pathname !== "/") return null;
    return url;
  } catch { return null; }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody || Buffer.byteLength(rawBody, "utf8") > 4096) return failure(413, "Corps invalide.");
    let body: { cameraId?: unknown };
    try { body = JSON.parse(rawBody); } catch { return failure(400, "JSON invalide."); }
    const cameraId = typeof body.cameraId === "string" ? body.cameraId : "";
    if (!uuid.test(cameraId)) return failure(400, "Caméra invalide.");

    const auth = await authenticateSignedSecurityGateway(request, rawBody);
    if (!auth.ok) return failure(auth.status, auth.error);
    if (auth.installation.status !== "pilot_active" ||
      auth.installation.legal_review_status !== "approved" ||
      auth.installation.privacy_notice_status !== "approved") {
      return failure(403, "Installation non autorisée à publier un flux.");
    }

    const [{ data: camera, error: cameraError }, { data: connection, error: connectionError }] = await Promise.all([
      auth.admin.from("naxa_security_cameras").select("id,pharmacie_id,gateway_id,status")
        .eq("id", cameraId).eq("pharmacie_id", auth.gateway.pharmacie_id)
        .eq("gateway_id", auth.gateway.id).maybeSingle(),
      auth.admin.from("naxa_security_camera_connections")
        .select("connection_status,last_tested_at,discovered_capabilities,is_primary")
        .eq("camera_id", cameraId).eq("pharmacie_id", auth.gateway.pharmacie_id)
        .eq("gateway_id", auth.gateway.id).eq("is_primary", true).maybeSingle(),
    ]);
    if (cameraError || connectionError) return failure(503, "Registre caméra indisponible.");
    if (!camera || ["disabled", "retired"].includes(camera.status)) return failure(404, "Caméra inconnue ou désactivée.");

    const testedAt = connection?.last_tested_at ? Date.parse(connection.last_tested_at) : NaN;
    const now = Date.now();
    if (!connection || connection.connection_status !== "connected" || connection.is_primary !== true ||
      !Array.isArray(connection.discovered_capabilities) ||
      !connection.discovered_capabilities.includes("live_view") ||
      !Number.isFinite(testedAt) || now - testedAt > 15 * 60 * 1000 || testedAt > now + 30_000) {
      return failure(409, "Le connecteur vidéo doit être testé récemment avec live_view.");
    }

    const origin = publishOrigin();
    if (!origin) return failure(503, "Relais RTSPS non configuré.");
    const token = randomBytes(32).toString("base64url");
    const tokenSha256 = createHash("sha256").update(token, "utf8").digest("hex");
    const mediaPath = "naxa/" + camera.pharmacie_id + "/" + camera.id;
    const expiresAt = new Date(now + 15 * 60 * 1000).toISOString();

    const { data: ticketId, error: ticketError } = await auth.admin.rpc(
      "naxa_security_issue_stream_publish_ticket",
      {
        p_pharmacie_id: auth.gateway.pharmacie_id,
        p_camera_id: camera.id,
        p_gateway_id: auth.gateway.id,
        p_token_sha256: tokenSha256,
        p_media_path: mediaPath,
        p_expires_at: expiresAt,
      },
    );
    if (ticketError || typeof ticketId !== "string" || !uuid.test(ticketId)) {
      return failure(ticketError?.code === "54000" ? 429 : 503, "Ticket publisher indisponible.");
    }

    origin.username = auth.gateway.id;
    origin.password = token;
    origin.pathname = "/" + mediaPath;
    return NextResponse.json({
      ok: true, cameraId: camera.id, mediaPath, publishUrl: origin.toString(), expiresAt,
    }, { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
  } catch {
    return failure(500, "Service publisher indisponible.");
  }
}

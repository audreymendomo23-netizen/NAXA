import { NextResponse } from "next/server";
import { authenticateSignedSecurityGateway } from "@/lib/security/gateway-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody || Buffer.byteLength(rawBody, "utf8") > 4096) {
      return NextResponse.json({ ok: false, error: "Corps statut invalide." }, { status: 413 });
    }
    let body: { cameraId?: unknown; state?: unknown; frameCount?: unknown };
    try { body = JSON.parse(rawBody); }
    catch { return NextResponse.json({ ok: false, error: "JSON invalide." }, { status: 400 }); }

    const cameraId = typeof body.cameraId === "string" ? body.cameraId : "";
    const state = body.state;
    const frameCount = body.frameCount;
    if (!uuid.test(cameraId) || !["online", "offline"].includes(String(state)) ||
      !Number.isSafeInteger(frameCount) || Number(frameCount) < 0 ||
      (state === "online" && Number(frameCount) < 1)) {
      return NextResponse.json({ ok: false, error: "Rapport flux invalide." }, { status: 400 });
    }

    const auth = await authenticateSignedSecurityGateway(request, rawBody);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    if (auth.installation.status !== "pilot_active" ||
      auth.installation.legal_review_status !== "approved" ||
      auth.installation.privacy_notice_status !== "approved") {
      return NextResponse.json({ ok: false, error: "Installation non autorisée." }, { status: 403 });
    }

    const { data: camera, error: cameraError } = await auth.admin.from("naxa_security_cameras")
      .select("id,status").eq("id", cameraId)
      .eq("pharmacie_id", auth.gateway.pharmacie_id)
      .eq("gateway_id", auth.gateway.id).maybeSingle();
    if (cameraError) return NextResponse.json({ ok: false, error: "Registre caméra indisponible." }, { status: 503 });
    if (!camera || ["disabled", "retired"].includes(camera.status)) {
      return NextResponse.json({ ok: false, error: "Caméra hors du périmètre passerelle." }, { status: 404 });
    }

    const { data, error } = await auth.admin.rpc("naxa_security_report_stream_health", {
      p_pharmacie_id: auth.gateway.pharmacie_id,
      p_camera_id: camera.id,
      p_gateway_id: auth.gateway.id,
      p_state: state,
      p_frame_count: Number(frameCount),
    });
    if (error || data !== true) return NextResponse.json({ ok: false, error: "Statut vidéo impossible." }, { status: 503 });
    return NextResponse.json({ ok: true, state }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "Service statut vidéo indisponible." }, { status: 500 });
  }
}

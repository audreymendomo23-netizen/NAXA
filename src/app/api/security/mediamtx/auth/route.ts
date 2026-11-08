import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GATEWAY_FRESHNESS_MS = 120 * 1000;
const CONNECTION_FRESHNESS_MS = 15 * 60 * 1000;

function isFresh(value: string | null, maxAgeMs: number, nowMs: number): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= nowMs + 30_000 &&
    nowMs - timestamp <= maxAgeMs;
}

function deny(status = 401) {
  return new NextResponse(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody || Buffer.byteLength(rawBody, "utf8") > 8192) return deny(413);

    let body: { token?: unknown; action?: unknown; protocol?: unknown; path?: unknown };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return deny(400);
    }

    const token = typeof body.token === "string" ? body.token : "";
    const path = typeof body.path === "string" ? body.path : "";
    if (!tokenPattern.test(token) || body.action !== "read" || body.protocol !== "webrtc" ||
      !/^naxa\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i.test(path)) {
      return deny();
    }

    const tokenSha256 = createHash("sha256").update(token, "utf8").digest("hex");
    const db = supabaseAdmin();
    const { data: session, error: sessionError } = await db
      .from("naxa_security_live_sessions")
      .select("id,pharmacie_id,camera_id,gateway_id,user_id,media_path,status,expires_at")
      .eq("token_sha256", tokenSha256)
      .eq("media_path", path)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (sessionError) return deny(503);
    if (!session || !uuid.test(session.camera_id) || !uuid.test(session.pharmacie_id)) return deny();

    const [{ data: camera, error: cameraError }, { data: gateway, error: gatewayError },
      { data: installation, error: installationError }, { data: pharmacy, error: pharmacyError },
      { data: profile, error: profileError }, { data: connection, error: connectionError },
      { data: assignment, error: assignmentError }] = await Promise.all([
      db.from("naxa_security_cameras").select("id,status")
        .eq("id", session.camera_id).eq("pharmacie_id", session.pharmacie_id).maybeSingle(),
      db.from("naxa_security_gateways").select("id,tunnel_status,last_seen_at")
        .eq("id", session.gateway_id).eq("pharmacie_id", session.pharmacie_id).maybeSingle(),
      db.from("naxa_security_installations").select("status,legal_review_status,privacy_notice_status")
        .eq("pharmacie_id", session.pharmacie_id).maybeSingle(),
      db.from("pharmacies").select("actif,visible_recherche,archivee_le")
        .eq("id", session.pharmacie_id).maybeSingle(),
      db.from("profiles").select("role,actif").eq("id", session.user_id).maybeSingle(),
      db.from("naxa_security_camera_connections")
        .select("connection_status,last_tested_at,discovered_capabilities,is_primary")
        .eq("camera_id", session.camera_id).eq("pharmacie_id", session.pharmacie_id)
        .eq("is_primary", true).maybeSingle(),
      db.from("promoteur_pharmacies").select("pharmacie_id")
        .eq("promoteur_id", session.user_id).eq("pharmacie_id", session.pharmacie_id)
        .eq("actif", true).maybeSingle(),
    ]);

    if (cameraError || gatewayError || installationError || pharmacyError ||
      profileError || connectionError || assignmentError) {
      return deny(503);
    }

    const nowMs = Date.now();
    const capabilities = Array.isArray(connection?.discovered_capabilities)
      ? connection.discovered_capabilities : [];
    const isAuthorized =
      camera?.status === "online" &&
      gateway?.tunnel_status === "connected" &&
      isFresh(gateway?.last_seen_at ?? null, GATEWAY_FRESHNESS_MS, nowMs) &&
      installation?.status === "pilot_active" &&
      installation.legal_review_status === "approved" &&
      installation.privacy_notice_status === "approved" &&
      pharmacy?.actif === true && pharmacy.visible_recherche === true && pharmacy.archivee_le === null &&
      profile?.role === "promoteur" && profile.actif === true &&
      assignment?.pharmacie_id === session.pharmacie_id &&
      connection?.connection_status === "connected" && connection.is_primary === true &&
      capabilities.includes("live_view") &&
      isFresh(connection.last_tested_at, CONNECTION_FRESHNESS_MS, nowMs);

    if (!isAuthorized) return deny();

    return NextResponse.json({ expireAt: new Date(session.expires_at).toISOString() }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return deny(503);
  }
}

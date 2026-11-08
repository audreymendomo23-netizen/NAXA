import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { loadPromoteurAccess } from "@/lib/promoteur-access";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIVE_SESSION_TTL_MS = 15 * 60 * 1000;
const GATEWAY_FRESHNESS_MS = 120 * 1000;
const CONNECTION_FRESHNESS_MS = 15 * 60 * 1000;

function mediaOrigin(): string | null {
  const value = process.env.NAXA_MEDIAMTX_PUBLIC_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password ||
      url.search || url.hash || url.pathname !== "/") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isFresh(value: string | null, maxAgeMs: number, nowMs: number): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= nowMs + 30_000 &&
    nowMs - timestamp <= maxAgeMs;
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody || Buffer.byteLength(rawBody, "utf8") > 4096) {
      return jsonError("Requête absente ou trop volumineuse.", 413);
    }

    let body: { cameraId?: unknown };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonError("JSON invalide.", 400);
    }

    const cameraId = typeof body.cameraId === "string" ? body.cameraId : "";
    if (!uuid.test(cameraId)) return jsonError("Caméra invalide.", 400);

    let access: Awaited<ReturnType<typeof loadPromoteurAccess>>;
    try {
      access = await loadPromoteurAccess();
    } catch {
      return jsonError("Session Promoteur non autorisée.", 401);
    }

    if (
      access.profile.role !== "promoteur" ||
      access.profile.actif !== true ||
      access.shouldShowAccessStatus ||
      access.linksError ||
      access.pharmaciesError
    ) {
      return jsonError("Accès Promoteur indisponible ou suspendu.", 403);
    }

    const db = supabaseAdmin();
    const { data: camera, error: cameraError } = await db
      .from("naxa_security_cameras")
      .select("id,pharmacie_id,gateway_id,status")
      .eq("id", cameraId)
      .maybeSingle();

    if (cameraError) return jsonError("Registre caméra temporairement indisponible.", 503);
    if (!camera || !access.activeLinkIds.has(camera.pharmacie_id)) {
      return jsonError("Caméra hors du périmètre Promoteur.", 404);
    }

    const pharmacy = (access.pharmacies ?? []).find((item) =>
      item.id === camera.pharmacie_id && item.actif && item.visible_recherche && item.archivee_le === null
    );
    if (!pharmacy || camera.status !== "online") {
      return jsonError("Caméra non déclarée opérationnelle.", 409);
    }

    const [{ data: gateway, error: gatewayError }, { data: installation, error: installationError },
      { data: connection, error: connectionError }] = await Promise.all([
      db.from("naxa_security_gateways")
        .select("id,pharmacie_id,installation_id,tunnel_status,last_seen_at")
        .eq("id", camera.gateway_id).eq("pharmacie_id", camera.pharmacie_id).maybeSingle(),
      db.from("naxa_security_installations")
        .select("status,legal_review_status,privacy_notice_status")
        .eq("pharmacie_id", camera.pharmacie_id).maybeSingle(),
      db.from("naxa_security_camera_connections")
        .select("connection_status,last_tested_at,discovered_capabilities,is_primary")
        .eq("camera_id", camera.id).eq("pharmacie_id", camera.pharmacie_id)
        .eq("is_primary", true).maybeSingle(),
    ]);

    if (gatewayError || installationError || connectionError) {
      return jsonError("État de sécurité temporairement indisponible.", 503);
    }

    const nowMs = Date.now();
    if (!gateway || gateway.tunnel_status !== "connected" ||
      !isFresh(gateway.last_seen_at, GATEWAY_FRESHNESS_MS, nowMs)) {
      return jsonError("Passerelle absente ou heartbeat trop ancien.", 409);
    }
    if (!installation || installation.status !== "pilot_active" ||
      installation.legal_review_status !== "approved" ||
      installation.privacy_notice_status !== "approved") {
      return jsonError("Installation non autorisée pour le direct.", 403);
    }
    const capabilities = Array.isArray(connection?.discovered_capabilities)
      ? connection.discovered_capabilities
      : [];
    if (!connection || connection.connection_status !== "connected" ||
      connection.is_primary !== true || !capabilities.includes("live_view") ||
      !isFresh(connection.last_tested_at, CONNECTION_FRESHNESS_MS, nowMs)) {
      return jsonError("Aucune connexion vidéo validée pour cette caméra.", 409);
    }

    const origin = mediaOrigin();
    if (!origin) return jsonError("Relais vidéo non configuré en HTTPS.", 503);

    const token = randomBytes(32).toString("base64url");
    const tokenSha256 = createHash("sha256").update(token, "utf8").digest("hex");
    const mediaPath = "naxa/" + camera.pharmacie_id + "/" + camera.id;
    const expiresAt = new Date(nowMs + LIVE_SESSION_TTL_MS).toISOString();

    const { data: sessionId, error: sessionError } = await db.rpc(
      "naxa_security_issue_live_session",
      {
        p_pharmacie_id: camera.pharmacie_id,
        p_camera_id: camera.id,
        p_gateway_id: camera.gateway_id,
        p_user_id: access.profile.id,
        p_token_sha256: tokenSha256,
        p_media_path: mediaPath,
        p_expires_at: expiresAt,
      },
    );

    if (sessionError || typeof sessionId !== "string" || !uuid.test(sessionId)) {
      console.error("[security.live] issue rejected", { code: sessionError?.code ?? "INVALID_RESULT" });
      return jsonError(sessionError?.code === "54000"
        ? "Quatre flux simultanés sont déjà ouverts. Fermez-en un avant de continuer."
        : "Impossible d’ouvrir la session vidéo.", sessionError?.code === "54000" ? 429 : 503);
    }

    return NextResponse.json({
      ok: true,
      cameraId: camera.id,
      mediaPath,
      whepUrl: origin + "/" + mediaPath + "/whep",
      authorization: "Bearer " + token,
      expiresAt,
      refreshAfterSeconds: 780,
    }, { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
  } catch (error) {
    console.error("[security.live] session unavailable", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return jsonError("Service vidéo momentanément indisponible.", 500);
  }
}

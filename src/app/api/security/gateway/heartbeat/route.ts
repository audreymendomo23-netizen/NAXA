import { createHash, createPublicKey, verify } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noncePattern = /^[A-Za-z0-9_-]{32,128}$/;
const allowedAgentCapabilities = new Set(["heartbeat"]);

function canonicalMessage(gatewayId: string, timestamp: string, nonce: string, rawBody: string): Uint8Array {
  const bodyHash = createHash("sha256").update(rawBody, "utf8").digest("hex");
  return new TextEncoder().encode(`${gatewayId}\n${timestamp}\n${nonce}\n${bodyHash}`);
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody || Buffer.byteLength(rawBody, "utf8") > 4096) {
      return NextResponse.json({ error: "Corps heartbeat absent ou trop volumineux." }, { status: 413 });
    }

    const gatewayId = request.headers.get("x-naxa-gateway-id") ?? "";
    const timestamp = request.headers.get("x-naxa-timestamp") ?? "";
    const nonce = request.headers.get("x-naxa-nonce") ?? "";
    const signatureText = request.headers.get("x-naxa-signature") ?? "";

    if (
      !uuid.test(gatewayId) ||
      !/^\d{10}$/.test(timestamp) ||
      !noncePattern.test(nonce) ||
      !/^[A-Za-z0-9_-]{80,100}$/.test(signatureText)
    ) {
      return NextResponse.json({ error: "En-têtes de passerelle incomplets ou invalides." }, { status: 401 });
    }

    const requestSeconds = Number(timestamp);
    const now = new Date();
    if (!Number.isSafeInteger(requestSeconds) || Math.abs(Math.floor(now.getTime() / 1000) - requestSeconds) > 120) {
      return NextResponse.json({ error: "Horodatage de signature hors fenêtre autorisée." }, { status: 401 });
    }

    let body: { agentVersion?: unknown; hostname?: unknown; capabilities?: unknown; reportedAt?: unknown };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "JSON heartbeat invalide." }, { status: 400 });
    }

    const agentVersion = String(body.agentVersion ?? "");
    const hostname = String(body.hostname ?? "");
    const reportedAt = String(body.reportedAt ?? "");
    const capabilities = Array.isArray(body.capabilities) ? body.capabilities : [];
    if (
      !/^[0-9A-Za-z][0-9A-Za-z.+_-]{0,39}$/.test(agentVersion) ||
      !/^[A-Za-z0-9._-]{1,100}$/.test(hostname) ||
      !Number.isFinite(Date.parse(reportedAt)) ||
      capabilities.length !== 1 ||
      capabilities.some((item) => typeof item !== "string" || !allowedAgentCapabilities.has(item))
    ) {
      return NextResponse.json({ error: "Métadonnées heartbeat non conformes." }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { data: gateway, error: gatewayError } = await admin
      .from("naxa_security_gateways")
      .select("id,pharmacie_id,installation_id,tunnel_status,health_metadata,agent_key_fingerprint")
      .eq("id", gatewayId)
      .maybeSingle();

    if (gatewayError || !gateway || gateway.tunnel_status === "revoked") {
      return NextResponse.json({ error: "Passerelle révoquée ou inconnue." }, { status: 403 });
    }

    const [{ data: pharmacy, error: pharmacyError }, { data: installation, error: installationError }] = await Promise.all([
      admin.from("pharmacies").select("actif,visible_recherche,archivee_le").eq("id", gateway.pharmacie_id).maybeSingle(),
      admin.from("naxa_security_installations").select("status").eq("id", gateway.installation_id).eq("pharmacie_id", gateway.pharmacie_id).maybeSingle(),
    ]);

    if (
      pharmacyError || !pharmacy || pharmacy.actif !== true || pharmacy.visible_recherche !== true || pharmacy.archivee_le !== null ||
      installationError || !installation || ["suspended", "retired"].includes(installation.status)
    ) {
      return NextResponse.json({ error: "Pharmacie ou installation suspendue." }, { status: 403 });
    }

    const { data: keyRecord, error: keyError } = await admin
      .from("naxa_security_gateway_enrollments")
      .select("id,public_key_pem,public_key_fingerprint")
      .eq("gateway_id", gatewayId)
      .eq("public_key_fingerprint", gateway.agent_key_fingerprint)
      .not("consumed_at", "is", null)
      .is("revoked_at", null)
      .order("consumed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (keyError || !keyRecord?.public_key_pem) {
      return NextResponse.json({ error: "Passerelle non enrôlée." }, { status: 401 });
    }

    // Uint8Array standard pour rester compatible avec les types crypto/TS du build.
    const signature = Uint8Array.from(Array.from(Buffer.from(signatureText, "base64url")));
    if (signature.byteLength !== 64) {
      return NextResponse.json({ error: "Signature passerelle invalide." }, { status: 401 });
    }

    let signatureValid = false;
    try {
      const publicKey = createPublicKey(keyRecord.public_key_pem);
      signatureValid = publicKey.asymmetricKeyType === "ed25519" &&
        verify(null, canonicalMessage(gatewayId, timestamp, nonce, rawBody), publicKey, signature);
    } catch {
      signatureValid = false;
    }
    if (!signatureValid) {
      return NextResponse.json({ error: "Signature passerelle invalide." }, { status: 401 });
    }

    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
    const { error: nonceError } = await admin.from("naxa_security_gateway_request_nonces").insert({
      gateway_id: gatewayId,
      nonce,
      signed_at: new Date(requestSeconds * 1000).toISOString(),
      expires_at: expiresAt,
    });

    if (nonceError?.code === "23505") {
      return NextResponse.json({ error: "Rejeu de requête détecté." }, { status: 409 });
    }
    if (nonceError) {
      console.error("NAXA_GATEWAY_NONCE_STORE_FAILED", nonceError.code);
      return NextResponse.json({ error: "Vérification anti-rejeu temporairement indisponible." }, { status: 503 });
    }

    const previousHealth = gateway.health_metadata && typeof gateway.health_metadata === "object"
      ? gateway.health_metadata as Record<string, unknown>
      : {};
    const { error: updateError } = await admin.from("naxa_security_gateways").update({
      tunnel_status: "connected",
      last_seen_at: now.toISOString(),
      agent_version: agentVersion,
      health_metadata: {
        ...previousHealth,
        agent_version: agentVersion,
        hostname,
        last_authenticated_at: now.toISOString(),
        capabilities: ["heartbeat"],
      },
      updated_at: now.toISOString(),
    }).eq("id", gatewayId).eq("pharmacie_id", gateway.pharmacie_id);

    await admin.from("naxa_security_gateway_request_nonces")
      .delete()
      .eq("gateway_id", gatewayId)
      .lt("expires_at", now.toISOString());

    if (updateError) {
      console.error("NAXA_GATEWAY_HEARTBEAT_UPDATE_FAILED", updateError.code);
      return NextResponse.json({ error: "Mise à jour du heartbeat impossible." }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      gatewayId,
      tunnelStatus: "connected",
      serverTime: now.toISOString(),
      note: "Heartbeat authentifié. Aucun flux caméra n'est activé par ce statut.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("NAXA_GATEWAY_HEARTBEAT_ERROR", error);
    return NextResponse.json({ error: "Heartbeat passerelle indisponible." }, { status: 500 });
  }
}

import { createPublicKey, createHash, verify } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noncePattern = /^[A-Za-z0-9_-]{32,128}$/;
const signaturePattern = /^[A-Za-z0-9_-]{80,100}$/;

type AuthFailure = { ok: false; status: number; error: string };
type AuthSuccess = {
  ok: true;
  admin: ReturnType<typeof supabaseAdmin>;
  gateway: {
    id: string; pharmacie_id: string; installation_id: string;
    tunnel_status: string; last_seen_at: string | null; agent_key_fingerprint: string | null;
  };
  pharmacy: { actif: boolean; visible_recherche: boolean; archivee_le: string | null };
  installation: { status: string; legal_review_status: string; privacy_notice_status: string };
};

export async function authenticateSignedSecurityGateway(
  request: Request,
  rawBody: string,
): Promise<AuthFailure | AuthSuccess> {
  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > 8192) {
    return { ok: false, status: 413, error: "Corps passerelle absent ou trop volumineux." };
  }
  const gatewayId = request.headers.get("x-naxa-gateway-id") ?? "";
  const timestamp = request.headers.get("x-naxa-timestamp") ?? "";
  const nonce = request.headers.get("x-naxa-nonce") ?? "";
  const signatureText = request.headers.get("x-naxa-signature") ?? "";
  if (!uuid.test(gatewayId) || !/^\d{10}$/.test(timestamp) ||
    !noncePattern.test(nonce) || !signaturePattern.test(signatureText)) {
    return { ok: false, status: 401, error: "Signature passerelle incomplète." };
  }

  const requestSeconds = Number(timestamp);
  const now = new Date();
  if (!Number.isSafeInteger(requestSeconds) ||
    Math.abs(Math.floor(now.getTime() / 1000) - requestSeconds) > 120) {
    return { ok: false, status: 401, error: "Horodatage de signature hors fenêtre." };
  }

  const admin = supabaseAdmin();
  const { data: gateway, error: gatewayError } = await admin
    .from("naxa_security_gateways")
    .select("id,pharmacie_id,installation_id,tunnel_status,last_seen_at,agent_key_fingerprint")
    .eq("id", gatewayId).maybeSingle();
  const lastSeen = gateway?.last_seen_at ? Date.parse(gateway.last_seen_at) : NaN;
  if (gatewayError) return { ok: false, status: 503, error: "Registre passerelle indisponible." };
  if (!gateway || gateway.tunnel_status !== "connected" || !Number.isFinite(lastSeen) ||
    now.getTime() - lastSeen > 120_000 || lastSeen > now.getTime() + 30_000) {
    return { ok: false, status: 403, error: "Passerelle inconnue, révoquée ou heartbeat périmé." };
  }

  const [{ data: pharmacy, error: pharmacyError }, { data: installation, error: installationError }] = await Promise.all([
    admin.from("pharmacies").select("actif,visible_recherche,archivee_le")
      .eq("id", gateway.pharmacie_id).maybeSingle(),
    admin.from("naxa_security_installations")
      .select("status,legal_review_status,privacy_notice_status")
      .eq("id", gateway.installation_id).eq("pharmacie_id", gateway.pharmacie_id).maybeSingle(),
  ]);
  if (pharmacyError || installationError) return { ok: false, status: 503, error: "État installation indisponible." };
  if (!pharmacy || pharmacy.actif !== true || pharmacy.visible_recherche !== true ||
    pharmacy.archivee_le !== null || !installation ||
    ["suspended","retired"].includes(installation.status)) {
    return { ok: false, status: 403, error: "Pharmacie ou installation suspendue." };
  }

  const { data: keyRecord, error: keyError } = await admin
    .from("naxa_security_gateway_enrollments").select("public_key_pem")
    .eq("gateway_id", gatewayId).eq("public_key_fingerprint", gateway.agent_key_fingerprint)
    .not("consumed_at", "is", null).is("revoked_at", null)
    .order("consumed_at", { ascending: false }).limit(1).maybeSingle();
  if (keyError) return { ok: false, status: 503, error: "Registre clés passerelle indisponible." };
  if (!keyRecord?.public_key_pem) return { ok: false, status: 401, error: "Passerelle non enrôlée." };

  const signature = Buffer.from(signatureText, "base64url");
  let valid = false;
  try {
    const publicKey = createPublicKey(keyRecord.public_key_pem);
    const digest = createHash("sha256").update(rawBody, "utf8").digest("hex");
    const canonical = Uint8Array.from(Buffer.from(gatewayId + "\n" + timestamp + "\n" + nonce + "\n" + digest, "utf8"));
    const signatureBytes = Uint8Array.from(signature);
    valid = signatureBytes.byteLength === 64 && publicKey.asymmetricKeyType === "ed25519" &&
      verify(null, canonical, publicKey, signatureBytes);
  } catch { valid = false; }
  if (!valid) return { ok: false, status: 401, error: "Signature passerelle invalide." };

  const { error: nonceError } = await admin.from("naxa_security_gateway_request_nonces").insert({
    gateway_id: gatewayId, nonce,
    signed_at: new Date(requestSeconds * 1000).toISOString(),
    expires_at: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
  });
  if (nonceError?.code === "23505") return { ok: false, status: 409, error: "Rejeu détecté." };
  if (nonceError) return { ok: false, status: 503, error: "Anti-rejeu indisponible." };
  return { ok: true, admin, gateway, pharmacy, installation };
}

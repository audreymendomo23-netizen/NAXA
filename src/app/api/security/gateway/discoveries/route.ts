import { createHash, createPublicKey, verify } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noncePattern = /^[A-Za-z0-9_-]{32,128}$/;
const signaturePattern = /^[A-Za-z0-9_-]{80,100}$/;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_DEVICES = 64;

type RawDevice = {
  deviceId?: unknown;
  sourceAddress?: unknown;
  types?: unknown;
  scopes?: unknown;
  endpoints?: unknown;
};

function canonicalMessage(gatewayId: string, timestamp: string, nonce: string, rawBody: string): Uint8Array {
  const bodyHash = createHash("sha256").update(rawBody, "utf8").digest("hex");
  return new TextEncoder().encode(`${gatewayId}\n${timestamp}\n${nonce}\n${bodyHash}`);
}

function isPrivateIpv4(value: string): boolean {
  if (isIP(value) !== 4) return false;
  const [a, b] = value.split(".").map(Number);
  return a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254);
}

function isLocalHost(value: string): boolean {
  const host = value.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(host) === 4) return isPrivateIpv4(host);
  if (isIP(host) === 6) return host === "::1" || /^f[cd]/i.test(host) || /^fe[89ab]/i.test(host);
  return host === "localhost" || host.endsWith(".local") || host.endsWith(".lan") ||
    host.endsWith(".home.arpa") || /^[a-z0-9-]{1,63}$/.test(host);
}

function safeText(value: unknown, max: number): string | null {
  if (typeof value !== "string" || value.length > max || /[\u0000-\u001f<>]/.test(value)) return null;
  return value.trim();
}

function safeEndpoint(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 512) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || !isLocalHost(url.hostname) || url.pathname.length > 256) return null;
    return url.protocol + "//" + url.host + url.pathname;
  } catch {
    return null;
  }
}

function normalizeDevices(value: unknown) {
  if (!Array.isArray(value) || value.length > MAX_DEVICES) return null;
  const normalized: Array<{
    discovery_key: string;
    device_id: string | null;
    source_address: string;
    device_types: string;
    device_scopes: string;
    endpoints: string[];
  }> = [];
  for (const item of value as RawDevice[]) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const sourceAddress = safeText(item.sourceAddress, 45);
    const deviceId = item.deviceId === null || item.deviceId === undefined
      ? null : safeText(item.deviceId, 160);
    const types = safeText(item.types ?? "", 512);
    const scopes = safeText(item.scopes ?? "", 1024);
    if (!sourceAddress || !isPrivateIpv4(sourceAddress) ||
      (item.deviceId !== null && item.deviceId !== undefined && !deviceId) ||
      types === null || scopes === null ||
      !Array.isArray(item.endpoints) || item.endpoints.length < 1 || item.endpoints.length > 4) return null;
    const endpoints = item.endpoints.map(safeEndpoint);
    if (endpoints.some((endpoint) => !endpoint)) return null;
    const safeEndpoints = Array.from(new Set(endpoints as string[]));
    if (!safeEndpoints.length) return null;
    const identity = deviceId || safeEndpoints.slice().sort().join("|");
    normalized.push({
      discovery_key: createHash("sha256").update(identity, "utf8").digest("hex"),
      device_id: deviceId,
      source_address: sourceAddress,
      device_types: types,
      device_scopes: scopes,
      endpoints: safeEndpoints,
    });
  }
  return normalized;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Rapport de découverte absent ou trop volumineux." }, { status: 413 });
    }
    const gatewayId = request.headers.get("x-naxa-gateway-id") ?? "";
    const timestamp = request.headers.get("x-naxa-timestamp") ?? "";
    const nonce = request.headers.get("x-naxa-nonce") ?? "";
    const signatureText = request.headers.get("x-naxa-signature") ?? "";
    if (!uuid.test(gatewayId) || !/^\d{10}$/.test(timestamp) ||
      !noncePattern.test(nonce) || !signaturePattern.test(signatureText)) {
      return NextResponse.json({ error: "En-têtes de passerelle incomplets ou invalides." }, { status: 401 });
    }

    const now = new Date();
    const requestSeconds = Number(timestamp);
    if (!Number.isSafeInteger(requestSeconds) ||
      Math.abs(Math.floor(now.getTime() / 1000) - requestSeconds) > 120) {
      return NextResponse.json({ error: "Horodatage de signature hors fenêtre autorisée." }, { status: 401 });
    }

    let body: { agentVersion?: unknown; reportedAt?: unknown; devices?: unknown };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "JSON de découverte invalide." }, { status: 400 });
    }
    const agentVersion = safeText(body.agentVersion, 40);
    const reportedAt = safeText(body.reportedAt, 40);
    const reportedTime = reportedAt ? Date.parse(reportedAt) : NaN;
    if (!agentVersion || !/^[0-9A-Za-z][0-9A-Za-z.+_-]{0,39}$/.test(agentVersion) ||
      !Number.isFinite(reportedTime) || Math.abs(now.getTime() - reportedTime) > 10 * 60 * 1000) {
      return NextResponse.json({ error: "Métadonnées de découverte non conformes." }, { status: 400 });
    }
    const devices = normalizeDevices(body.devices);
    if (!devices) {
      return NextResponse.json({ error: "Liste d'appareils découverte invalide ou hors limites." }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { data: gateway, error: gatewayError } = await admin
      .from("naxa_security_gateways")
      .select("id,pharmacie_id,installation_id,tunnel_status,agent_key_fingerprint")
      .eq("id", gatewayId)
      .maybeSingle();
    if (gatewayError || !gateway || gateway.tunnel_status === "revoked") {
      return NextResponse.json({ error: "Passerelle révoquée ou inconnue." }, { status: 403 });
    }

    const [{ data: pharmacy, error: pharmacyError }, { data: installation, error: installationError }] = await Promise.all([
      admin.from("pharmacies").select("actif,visible_recherche,archivee_le")
        .eq("id", gateway.pharmacie_id).maybeSingle(),
      admin.from("naxa_security_installations").select("status")
        .eq("id", gateway.installation_id).eq("pharmacie_id", gateway.pharmacie_id).maybeSingle(),
    ]);
    if (pharmacyError || !pharmacy || pharmacy.actif !== true || pharmacy.visible_recherche !== true ||
      pharmacy.archivee_le !== null || installationError || !installation ||
      ["suspended", "retired"].includes(installation.status)) {
      return NextResponse.json({ error: "Pharmacie ou installation suspendue." }, { status: 403 });
    }

    const { data: keyRecord, error: keyError } = await admin
      .from("naxa_security_gateway_enrollments")
      .select("public_key_pem")
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

    let signatureValid = false;
    try {
      const signature = Uint8Array.from(Array.from(Buffer.from(signatureText, "base64url")));
      const publicKey = createPublicKey(keyRecord.public_key_pem);
      signatureValid = signature.byteLength === 64 && publicKey.asymmetricKeyType === "ed25519" &&
        verify(null, canonicalMessage(gatewayId, timestamp, nonce, rawBody), publicKey, signature);
    } catch {
      signatureValid = false;
    }
    if (!signatureValid) {
      return NextResponse.json({ error: "Signature passerelle invalide." }, { status: 401 });
    }

    const { error: nonceError } = await admin.from("naxa_security_gateway_request_nonces").insert({
      gateway_id: gatewayId,
      nonce,
      signed_at: new Date(requestSeconds * 1000).toISOString(),
      expires_at: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
    });
    if (nonceError?.code === "23505") {
      return NextResponse.json({ error: "Rejeu de rapport détecté." }, { status: 409 });
    }
    if (nonceError) {
      console.error("NAXA_GATEWAY_DISCOVERY_NONCE_FAILED", nonceError.code);
      return NextResponse.json({ error: "Contrôle anti-rejeu temporairement indisponible." }, { status: 503 });
    }

    const savedIds: string[] = [];
    for (const device of devices) {
      const candidateValues = {
        pharmacie_id: gateway.pharmacie_id,
        ...device,
        last_seen_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
      const { data: existingCandidate, error: existingCandidateError } = await admin
        .from("naxa_security_camera_discovery_candidates")
        .select("id,status")
        .eq("gateway_id", gatewayId)
        .eq("discovery_key", device.discovery_key)
        .maybeSingle();

      if (existingCandidateError) {
        console.error("NAXA_GATEWAY_DISCOVERY_CANDIDATE_LOOKUP_FAILED", existingCandidateError.code);
        return NextResponse.json({
          error: "Lecture du registre de découverte indisponible.",
          receivedCount: savedIds.length,
        }, { status: 503 });
      }

      let savedCandidateId: string | null = null;
      if (existingCandidate) {
        // Ne jamais réinitialiser status, camera_id ou reviewed_by lors d'une redécouverte.
        const { data: updatedCandidate, error: updateCandidateError } = await admin
          .from("naxa_security_camera_discovery_candidates")
          .update(candidateValues)
          .eq("id", existingCandidate.id)
          .select("id")
          .maybeSingle();
        if (updateCandidateError || !updatedCandidate) {
          console.error("NAXA_GATEWAY_DISCOVERY_CANDIDATE_UPDATE_FAILED", updateCandidateError?.code);
          return NextResponse.json({
            error: "Mise à jour du candidat impossible ; relancez une découverte pour réconcilier les appareils.",
            receivedCount: savedIds.length,
          }, { status: 503 });
        }
        savedCandidateId = updatedCandidate.id;
      } else {
        const { data: createdCandidate, error: createCandidateError } = await admin
          .from("naxa_security_camera_discovery_candidates")
          .insert({
            gateway_id: gatewayId,
            ...candidateValues,
            status: "pending",
          })
          .select("id")
          .maybeSingle();

        if (createCandidateError?.code === "23505") {
          // Une découverte concurrente peut avoir inséré la même identité : relire puis actualiser sans écraser la revue.
          const { data: racedCandidate, error: raceReadError } = await admin
            .from("naxa_security_camera_discovery_candidates")
            .select("id")
            .eq("gateway_id", gatewayId)
            .eq("discovery_key", device.discovery_key)
            .maybeSingle();
          if (!raceReadError && racedCandidate) {
            const { data: racedUpdate, error: racedUpdateError } = await admin
              .from("naxa_security_camera_discovery_candidates")
              .update(candidateValues)
              .eq("id", racedCandidate.id)
              .select("id")
              .maybeSingle();
            if (!racedUpdateError && racedUpdate) savedCandidateId = racedUpdate.id;
          }
        } else if (!createCandidateError && createdCandidate) {
          savedCandidateId = createdCandidate.id;
        }

        if (!savedCandidateId) {
          console.error("NAXA_GATEWAY_DISCOVERY_CANDIDATE_SAVE_FAILED", createCandidateError?.code);
          return NextResponse.json({
            error: "Rapport partiellement reçu ; relancez une découverte pour réconcilier les appareils.",
            receivedCount: savedIds.length,
          }, { status: 503 });
        }
      }
      if (typeof savedCandidateId !== "string" || savedCandidateId.length === 0) {
        return NextResponse.json({
          error: "Identifiant de candidat absent après enregistrement.",
          receivedCount: savedIds.length,
        }, { status: 503 });
      }
      savedIds.push(savedCandidateId);
    }

    const { error: auditError } = await admin.from("naxa_security_access_audit").insert({
      pharmacie_id: gateway.pharmacie_id,
      actor_id: null,
      actor_role: "system",
      action: "device_update",
      resource_type: "gateway",
      resource_id: gatewayId,
      justification: "Réception d'un rapport ONVIF WS-Discovery signé ; appareils placés en attente de revue humaine.",
      audit_metadata: { operation: "onvif_discovery_report", device_count: devices.length, agent_version: agentVersion },
    });
    if (auditError) {
      console.error("NAXA_GATEWAY_DISCOVERY_AUDIT_FAILED", auditError.code);
      return NextResponse.json({
        error: "Appareils reçus mais journalisation incomplète ; une nouvelle découverte réconciliera le rapport.",
        receivedCount: savedIds.length,
      }, { status: 503 });
    }

    await admin.from("naxa_security_gateway_request_nonces")
      .delete().eq("gateway_id", gatewayId).lt("expires_at", now.toISOString());

    return NextResponse.json({
      ok: true,
      gatewayId,
      candidateCount: savedIds.length,
      reviewRequired: true,
      note: "Les appareils sont en attente de validation Promoteur. Aucun flux caméra n'a été contacté ou activé.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("NAXA_GATEWAY_DISCOVERY_REPORT_ERROR", error);
    return NextResponse.json({ error: "Réception du rapport de découverte indisponible." }, { status: 500 });
  }
}

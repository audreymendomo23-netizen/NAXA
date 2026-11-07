import { createHash, createPublicKey } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody || Buffer.byteLength(rawBody, "utf8") > 4096) {
      return NextResponse.json({ error: "Demande d'enrôlement trop volumineuse." }, { status: 413 });
    }
    const body = JSON.parse(rawBody) as {
      token?: unknown;
      gatewayId?: unknown;
      publicKeyPem?: unknown;
    };

    const token = String(body?.token ?? "");
    const gatewayId = String(body?.gatewayId ?? "");
    const publicKeyPem = String(body?.publicKeyPem ?? "");
    if (!/^[0-9a-f]{64}$/i.test(token) || !uuid.test(gatewayId) || publicKeyPem.length < 80 || publicKeyPem.length > 2048) {
      return NextResponse.json({ error: "Code ou identité de passerelle invalide." }, { status: 400 });
    }

    let publicKey;
    try {
      publicKey = createPublicKey(publicKeyPem);
    } catch {
      return NextResponse.json({ error: "Clé publique invalide." }, { status: 400 });
    }
    if (publicKey.asymmetricKeyType !== "ed25519") {
      return NextResponse.json({ error: "La passerelle doit fournir une clé Ed25519." }, { status: 400 });
    }

    const canonicalPublicKey = String(publicKey.export({ type: "spki", format: "pem" }));
    const fingerprint = createHash("sha256")
      .update(publicKey.export({ type: "spki", format: "der" }))
      .digest("hex");
    const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
    const admin = supabaseAdmin();
    const now = new Date();

    const { data: enrollment, error: enrollmentError } = await admin
      .from("naxa_security_gateway_enrollments")
      .select("id,gateway_id,pharmacie_id,expires_at,consumed_at,public_key_fingerprint,revoked_at")
      .eq("gateway_id", gatewayId)
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (enrollmentError || !enrollment || enrollment.revoked_at) {
      return NextResponse.json({ error: "Code expiré, révoqué ou invalide." }, { status: 401 });
    }

    const { data: gateway, error: gatewayError } = await admin
      .from("naxa_security_gateways")
      .select("id,pharmacie_id,installation_id,tunnel_status")
      .eq("id", gatewayId)
      .eq("pharmacie_id", enrollment.pharmacie_id)
      .maybeSingle();

    if (gatewayError || !gateway || gateway.tunnel_status === "revoked") {
      return NextResponse.json({ error: "Passerelle révoquée ou indisponible." }, { status: 403 });
    }

    const { data: pharmacy, error: pharmacyError } = await admin
      .from("pharmacies")
      .select("id,actif,visible_recherche,archivee_le")
      .eq("id", enrollment.pharmacie_id)
      .maybeSingle();

    const { data: installation, error: installationError } = await admin
      .from("naxa_security_installations")
      .select("id,status")
      .eq("id", gateway.installation_id)
      .eq("pharmacie_id", enrollment.pharmacie_id)
      .maybeSingle();

    if (
      pharmacyError || !pharmacy || pharmacy.actif !== true || pharmacy.visible_recherche !== true || pharmacy.archivee_le !== null ||
      installationError || !installation || ["suspended", "retired"].includes(installation.status)
    ) {
      return NextResponse.json({ error: "Pharmacie ou installation non autorisée." }, { status: 403 });
    }

    let enrollmentId = enrollment.id;
    if (enrollment.consumed_at) {
      // Reprise idempotente après une erreur réseau/DB : seul le détenteur de la même clé peut terminer l'opération.
      if (enrollment.public_key_fingerprint !== fingerprint) {
        return NextResponse.json({ error: "Code déjà utilisé par une autre identité." }, { status: 409 });
      }
    } else {
      if (new Date(enrollment.expires_at).getTime() <= now.getTime()) {
        return NextResponse.json({ error: "Code expiré." }, { status: 401 });
      }
      const { data: consumed, error: consumeError } = await admin
        .from("naxa_security_gateway_enrollments")
        .update({
          consumed_at: now.toISOString(),
          public_key_pem: canonicalPublicKey,
          public_key_fingerprint: fingerprint,
        })
        .eq("id", enrollment.id)
        .is("consumed_at", null)
        .is("revoked_at", null)
        .gt("expires_at", now.toISOString())
        .select("id")
        .maybeSingle();

      if (consumeError || !consumed) {
        return NextResponse.json({ error: "Le code a expiré ou vient d'être utilisé." }, { status: 409 });
      }
      enrollmentId = consumed.id;
    }

    // Le fingerprint courant fait basculer l'identité active. Les anciennes clés ne sont révoquées qu'après la consommation atomique du code.
    const { error: gatewayUpdateError } = await admin
      .from("naxa_security_gateways")
      .update({
        tunnel_status: "pending",
        agent_key_fingerprint: fingerprint,
        updated_at: now.toISOString(),
        health_metadata: { enrollment: "key_registered", fingerprint },
      })
      .eq("id", gatewayId)
      .eq("pharmacie_id", enrollment.pharmacie_id);

    if (gatewayUpdateError) {
      console.error("NAXA_GATEWAY_ENROLLMENT_GATEWAY_UPDATE_FAILED", gatewayUpdateError.code);
      return NextResponse.json({ error: "La clé est enregistrée mais le statut passerelle doit être réconcilié. Relancez enroll avec le même dossier local et le même code." }, { status: 503 });
    }

    const { error: revokeOldKeysError } = await admin
      .from("naxa_security_gateway_enrollments")
      .update({ revoked_at: now.toISOString() })
      .eq("gateway_id", gatewayId)
      .not("consumed_at", "is", null)
      .is("revoked_at", null)
      .neq("id", enrollmentId);

    if (revokeOldKeysError) {
      console.error("NAXA_GATEWAY_OLD_KEY_REVOCATION_FAILED", revokeOldKeysError.code);
      // Heartbeats ne sélectionneront que le fingerprint courant du gateway.
    }

    const { error: auditError } = await admin.from("naxa_security_access_audit").insert({
      pharmacie_id: enrollment.pharmacie_id,
      actor_id: null,
      actor_role: "system",
      action: "device_update",
      resource_type: "gateway",
      resource_id: gatewayId,
      justification: "Enrôlement de la passerelle par code à usage unique et clé publique Ed25519.",
      audit_metadata: { enrollment_id: enrollmentId, key_fingerprint: fingerprint },
    });

    if (gatewayUpdateError || auditError) {
      console.error("NAXA_GATEWAY_ENROLLMENT_PARTIAL", {
        oldKeys: revokeOldKeysError?.code ?? null,
        audit: auditError?.code ?? null,
      });
      return NextResponse.json({
        ok: true,
        tunnelStatus: "pending",
        keyFingerprint: fingerprint,
        auditLogged: !auditError,
        gatewayUpdated: !gatewayUpdateError,
        note: "Clé acceptée ; le statut technique ou le journal nécessite une vérification.",
      }, { status: 202, headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({
      ok: true,
      tunnelStatus: "pending",
      keyFingerprint: fingerprint,
      auditLogged: true,
      note: "Clé enregistrée. Le tunnel sera considéré connecté après le premier heartbeat signé.",
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("NAXA_GATEWAY_ENROLLMENT_ERROR", error);
    return NextResponse.json({ error: "Enrôlement de la passerelle indisponible." }, { status: 500 });
  }
}

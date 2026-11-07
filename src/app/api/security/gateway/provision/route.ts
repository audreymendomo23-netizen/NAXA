import { randomBytes, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { loadPromoteurAccess } from "@/lib/promoteur-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const { data: auth, error: authError } = await supabaseServer().auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json({ error: "Connexion Promoteur requise." }, { status: 401 });
    }

    const access = await loadPromoteurAccess();
    if (
      access.profile.role !== "promoteur" ||
      access.profile.actif !== true ||
      access.shouldShowAccessStatus ||
      access.linksError ||
      access.pharmaciesError
    ) {
      return NextResponse.json({ error: "Le compte Promoteur ou son réseau n'est pas autorisé à enrôler une passerelle." }, { status: 403 });
    }

    const body = await request.json().catch(() => null) as { gatewayId?: unknown } | null;
    const gatewayId = String(body?.gatewayId ?? "");
    if (!uuid.test(gatewayId)) {
      return NextResponse.json({ error: "Identifiant passerelle invalide." }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { data: gateway, error: gatewayError } = await admin
      .from("naxa_security_gateways")
      .select("id,pharmacie_id,installation_id,tunnel_status")
      .eq("id", gatewayId)
      .maybeSingle();

    if (gatewayError || !gateway) {
      return NextResponse.json({ error: "Passerelle introuvable ou inaccessible." }, { status: 404 });
    }

    const pharmacy = (access.pharmacies ?? []).find((item) => item.id === gateway.pharmacie_id);
    if (
      !access.activeLinkIds.has(gateway.pharmacie_id) ||
      !pharmacy ||
      pharmacy.actif !== true ||
      pharmacy.visible_recherche !== true ||
      pharmacy.archivee_le !== null ||
      gateway.tunnel_status === "revoked"
    ) {
      return NextResponse.json({ error: "Cette passerelle n'appartient pas à une pharmacie active de votre réseau." }, { status: 403 });
    }

    const { data: installation, error: installationError } = await admin
      .from("naxa_security_installations")
      .select("id,status")
      .eq("id", gateway.installation_id)
      .eq("pharmacie_id", gateway.pharmacie_id)
      .maybeSingle();

    if (installationError || !installation || ["suspended", "retired"].includes(installation.status)) {
      return NextResponse.json({ error: "L'installation est suspendue, retirée ou indisponible." }, { status: 403 });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");

    const { error: revokePendingError } = await admin
      .from("naxa_security_gateway_enrollments")
      .update({ revoked_at: now.toISOString() })
      .eq("gateway_id", gatewayId)
      .is("consumed_at", null)
      .is("revoked_at", null);

    if (revokePendingError) {
      console.error("NAXA_GATEWAY_REVOKE_PENDING_FAILED", revokePendingError.code);
      return NextResponse.json({ error: "Rotation du code de jumelage impossible." }, { status: 503 });
    }

    const { data: enrollment, error: insertError } = await admin
      .from("naxa_security_gateway_enrollments")
      .insert({
        gateway_id: gatewayId,
        pharmacie_id: gateway.pharmacie_id,
        token_hash: tokenHash,
        created_by: auth.user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !enrollment) {
      console.error("NAXA_GATEWAY_PROVISION_FAILED", insertError?.code);
      return NextResponse.json({ error: "Création du code de jumelage impossible. Réessayez." }, { status: 503 });
    }

    const { error: auditError } = await admin.from("naxa_security_access_audit").insert({
      pharmacie_id: gateway.pharmacie_id,
      actor_id: auth.user.id,
      actor_role: "promoteur",
      action: "device_update",
      resource_type: "gateway",
      resource_id: gatewayId,
      justification: "Création d'un code de jumelage à usage unique, durée 15 minutes.",
      audit_metadata: { enrollment_id: enrollment.id, expires_at: expiresAt.toISOString() },
    });

    if (auditError) {
      await admin.from("naxa_security_gateway_enrollments")
        .update({ revoked_at: new Date().toISOString() }).eq("id", enrollment.id);
      console.error("NAXA_GATEWAY_PROVISION_AUDIT_FAILED", auditError.code);
      return NextResponse.json({ error: "Le journal de sécurité n'a pas confirmé l'opération. Aucun code actif n'est délivré." }, { status: 503 });
    }

    return NextResponse.json({
      token,
      expiresAt: expiresAt.toISOString(),
      gatewayId,
      oneTime: true,
      note: "Ce code n'est affiché qu'une seule fois. Il expire dans 15 minutes.",
    }, {
      status: 201,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" },
    });
  } catch (error) {
    console.error("NAXA_GATEWAY_PROVISION_ERROR", error);
    return NextResponse.json({ error: "Enrôlement temporairement indisponible." }, { status: 500 });
  }
}

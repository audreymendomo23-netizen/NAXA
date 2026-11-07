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
      access.linksError ||
      access.pharmaciesError
    ) {
      return NextResponse.json({ error: "Un compte Promoteur actif est requis pour révoquer cette passerelle." }, { status: 403 });
    }

    const rawBody = await request.text();
    if (!rawBody || Buffer.byteLength(rawBody, "utf8") > 4096) {
      return NextResponse.json({ error: "Demande de révocation trop volumineuse." }, { status: 413 });
    }

    let body: { gatewayId?: unknown; reason?: unknown };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
    }

    const gatewayId = String(body.gatewayId ?? "");
    const reason = String(body.reason ?? "").trim();
    if (!uuid.test(gatewayId) || reason.length < 10 || reason.length > 500 || /[\u0000-\u001f]/.test(reason)) {
      return NextResponse.json({ error: "Identifiant passerelle ou justification invalide (10 à 500 caractères requis)." }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { data: gateway, error: gatewayReadError } = await admin
      .from("naxa_security_gateways")
      .select("id,pharmacie_id,tunnel_status")
      .eq("id", gatewayId)
      .maybeSingle();

    if (gatewayReadError || !gateway) {
      return NextResponse.json({ error: "Passerelle introuvable." }, { status: 404 });
    }

    // Le Promoteur peut révoquer une passerelle de son réseau même si la pharmacie est suspendue.
    if (!access.activeLinkIds.has(gateway.pharmacie_id)) {
      return NextResponse.json({ error: "Cette passerelle n'appartient pas à votre réseau actif." }, { status: 403 });
    }

    const now = new Date().toISOString();
    const { data: updatedGateway, error: gatewayUpdateError } = await admin
      .from("naxa_security_gateways")
      .update({ tunnel_status: "revoked", updated_at: now })
      .eq("id", gatewayId)
      .eq("pharmacie_id", gateway.pharmacie_id)
      .select("id")
      .maybeSingle();

    if (gatewayUpdateError || !updatedGateway) {
      console.error("NAXA_GATEWAY_REVOKE_STATUS_FAILED", gatewayUpdateError?.code ?? "NOT_FOUND");
      return NextResponse.json({ error: "Le statut de la passerelle n'a pas pu être révoqué." }, { status: 503 });
    }

    // Le statut gateway=revoked bloque déjà les heartbeats. Cette mise à jour invalide
    // également tous les codes et toutes les clés publiques conservés dans le registre.
    const { error: enrollmentRevokeError } = await admin
      .from("naxa_security_gateway_enrollments")
      .update({ revoked_at: now })
      .eq("gateway_id", gatewayId)
      .is("revoked_at", null);

    const { error: auditError } = await admin.from("naxa_security_access_audit").insert({
      pharmacie_id: gateway.pharmacie_id,
      actor_id: auth.user.id,
      actor_role: "promoteur",
      action: "device_update",
      resource_type: "gateway",
      resource_id: gatewayId,
      justification: reason,
      audit_metadata: {
        operation: "gateway_revoke",
        revoked_at: now,
        enrollment_keys_revoked: !enrollmentRevokeError,
      },
    });

    if (enrollmentRevokeError || auditError) {
      console.error("NAXA_GATEWAY_REVOKE_PARTIAL", {
        enrollments: enrollmentRevokeError?.code ?? null,
        audit: auditError?.code ?? null,
      });
      return NextResponse.json({
        ok: false,
        tunnelStatus: "revoked",
        enrollmentKeysRevoked: !enrollmentRevokeError,
        auditLogged: !auditError,
        error: "Le serveur refuse désormais les heartbeats de cette passerelle, mais le nettoyage des clés ou le journal doit être vérifié.",
      }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({
      ok: true,
      tunnelStatus: "revoked",
      enrollmentKeysRevoked: true,
      auditLogged: true,
      note: "Passerelle révoquée. Les prochains heartbeats sont refusés par NAXA.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("NAXA_GATEWAY_REVOKE_ERROR", error);
    return NextResponse.json({ error: "Révocation de la passerelle temporairement indisponible." }, { status: 500 });
  }
}

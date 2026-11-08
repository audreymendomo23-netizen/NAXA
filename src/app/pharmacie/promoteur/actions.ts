"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { loadPromoteurAccess } from "@/lib/promoteur-access";
import { estCoordonneeCamerounaise } from "@/lib/server/delivery-routing";
const field = (data: FormData, key: string) => String(data.get(key) ?? "").trim();

export async function modifierGeolocalisationPharmacie(formData: FormData) {
  const access = await loadPromoteurAccess();
  const pharmacieId = field(formData, "pharmacie_id");
  const lat = Number(field(formData, "lat")), lng = Number(field(formData, "lng"));
  const source = field(formData, "geo_source_type");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (access.profile.role !== "promoteur" || access.profile.actif !== true || access.linksError || access.pharmaciesError
    || !uuid.test(pharmacieId) || !access.activeLinkIds.has(pharmacieId)
    || !(access.pharmacies ?? []).some(ph => ph.id === pharmacieId && ph.archivee_le === null)
    || !["gps", "saisie_manuelle"].includes(source) || !estCoordonneeCamerounaise({ lat, lng })) {
    redirect("/pharmacie/promoteur/reseau?geo=perimetre");
  }
  const db = supabaseAdmin();
  const previous = (access.pharmacies ?? []).find(ph => ph.id === pharmacieId)!;
  const now = new Date().toISOString();
  const { data: updated, error } = await db.from("pharmacies").update({
    lat, lng, geo_statut: "a_verifier", geo_source_type: source, geo_mise_a_jour: now,
    geo_verifiee_par: null, geo_verifiee_le: null,
  }).eq("id", pharmacieId).select("id").maybeSingle();
  if (error || !updated) redirect("/pharmacie/promoteur/reseau?geo=echec");
  const { error: auditError } = await db.from("naxa_pharmacie_geo_audit").insert({
    pharmacie_id: pharmacieId, acteur_id: access.profile.id, role_acteur: "promoteur", event_type: "mise_a_jour", source_type: source,
    latitude_precedente: previous.lat, longitude_precedente: previous.lng, latitude_nouvelle: lat, longitude_nouvelle: lng,
    statut_precedent: previous.geo_statut, statut_nouveau: "a_verifier",
  });
  if (auditError) {
    console.error("[promoteur.geo] audit", { code: auditError.code, message: auditError.message });
    redirect("/pharmacie/promoteur/reseau?geo=journal");
  }
  revalidatePath("/pharmacie/promoteur"); revalidatePath("/pharmacie/promoteur/reseau");
  revalidatePath("/admin/pharmacies/" + pharmacieId);
  redirect("/pharmacie/promoteur/reseau?geo=mis-a-jour");
}


export async function declarerCameraSecurite(formData: FormData) {
  const access = await loadPromoteurAccess();
  const pharmacyId = field(formData, "pharmacie_id");
  const gatewayId = field(formData, "gateway_id");
  const gatewayLabel = field(formData, "gateway_label");
  const gatewaySerial = field(formData, "gateway_serial_number");
  const gatewayFirmware = field(formData, "gateway_firmware_version");
  const manufacturer = field(formData, "manufacturer");
  const model = field(formData, "model");
  const firmware = field(formData, "firmware_version");
  const zoneLabel = field(formData, "zone_label");
  const channelKeyInput = field(formData, "channel_key");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const safeDeviceText = (value: string, max: number) => value.length <= max && !/[<>\u0000-\u001f]/.test(value);

  const pharmacy = (access.pharmacies ?? []).find((item) => item.id === pharmacyId);
  if (
    access.profile.role !== "promoteur" ||
    access.profile.actif !== true ||
    access.shouldShowAccessStatus ||
    access.linksError ||
    access.pharmaciesError ||
    !uuid.test(pharmacyId) ||
    !access.activeLinkIds.has(pharmacyId) ||
    !pharmacy ||
    !pharmacy.actif ||
    !pharmacy.visible_recherche ||
    pharmacy.archivee_le !== null ||
    !safeDeviceText(zoneLabel, 100) ||
    zoneLabel.length < 2 ||
    !safeDeviceText(manufacturer, 80) ||
    !safeDeviceText(model, 120) ||
    !safeDeviceText(firmware, 80) ||
    !safeDeviceText(gatewayLabel, 100) ||
    !safeDeviceText(gatewaySerial, 100) ||
    !safeDeviceText(gatewayFirmware, 80) ||
    !safeDeviceText(channelKeyInput, 80) ||
    (channelKeyInput && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(channelKeyInput)) ||
    (gatewayId && !uuid.test(gatewayId))
  ) {
    redirect("/pharmacie/promoteur/securite?security=perimetre");
  }

  const db = supabaseAdmin();
  let { data: installation, error: installationReadError } = await db
    .from("naxa_security_installations")
    .select("id")
    .eq("pharmacie_id", pharmacyId)
    .maybeSingle();

  if (installationReadError) redirect("/pharmacie/promoteur/securite?security=registre");
  if (!installation) {
    const created = await db.from("naxa_security_installations")
      .insert({ pharmacie_id: pharmacyId, status: "inventory", created_by: access.profile.id })
      .select("id")
      .single();
    if (created.error || !created.data) {
      // Une déclaration concurrente peut avoir créé le dossier entre-temps.
      const retry = await db.from("naxa_security_installations")
        .select("id")
        .eq("pharmacie_id", pharmacyId)
        .maybeSingle();
      if (retry.error || !retry.data) redirect("/pharmacie/promoteur/securite?security=registre");
      installation = retry.data;
    } else {
      installation = created.data;
    }
  }

  let resolvedGatewayId = gatewayId;
  let createdGateway = false;
  if (resolvedGatewayId) {
    const existingGateway = await db.from("naxa_security_gateways")
      .select("id")
      .eq("id", resolvedGatewayId)
      .eq("pharmacie_id", pharmacyId)
      .eq("installation_id", installation.id)
      .maybeSingle();
    if (existingGateway.error || !existingGateway.data) {
      redirect("/pharmacie/promoteur/securite?security=passerelle");
    }
  } else {
    if (gatewayLabel.length < 2) redirect("/pharmacie/promoteur/securite?security=passerelle_requise");
    const created = await db.from("naxa_security_gateways").insert({
      pharmacie_id: pharmacyId,
      installation_id: installation.id,
      label: gatewayLabel,
      serial_number: gatewaySerial || null,
      firmware_version: gatewayFirmware || null,
      connection_mode: "outbound_tunnel",
      tunnel_status: "not_configured",
    }).select("id").single();
    if (created.error || !created.data) {
      redirect("/pharmacie/promoteur/securite?security=passerelle_echec");
    }
    resolvedGatewayId = created.data.id;
    createdGateway = true;
  }

  const channelKey = channelKeyInput || `manual-${randomUUID()}`;
  const camera = await db.from("naxa_security_cameras").insert({
    pharmacie_id: pharmacyId,
    gateway_id: resolvedGatewayId,
    channel_key: channelKey,
    manufacturer: manufacturer || null,
    model: model || null,
    firmware_version: firmware || null,
    zone_label: zoneLabel,
    onvif_profiles: [],
    status: "registered",
    capabilities: {},
  }).select("id").single();

  if (camera.error || !camera.data) {
    revalidatePath("/pharmacie/promoteur/securite");
    redirect("/pharmacie/promoteur/securite?security=camera_echec");
  }

  const audit = await db.from("naxa_security_access_audit").insert({
    pharmacie_id: pharmacyId,
    actor_id: access.profile.id,
    actor_role: "promoteur",
    action: "device_update",
    resource_type: "camera",
    resource_id: camera.data.id,
    justification: "Déclaration d'inventaire caméra par le Promoteur.",
    audit_metadata: { source: "promoteur_ui", created_gateway: createdGateway },
  });

  revalidatePath("/pharmacie/promoteur/securite");
  revalidatePath("/pharmacie/promoteur");
  if (audit.error) {
    console.error("[promoteur.security] audit", { code: audit.error.code, message: audit.error.message });
    redirect("/pharmacie/promoteur/securite?security=journal");
  }
  redirect("/pharmacie/promoteur/securite?security=declared");
}


export async function examinerCameraDecouverte(formData: FormData) {
  const access = await loadPromoteurAccess();
  const candidateId = field(formData, "candidate_id");
  const decision = field(formData, "decision");
  const zoneLabel = field(formData, "zone_label");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const safeLabel = zoneLabel.length >= 2 && zoneLabel.length <= 100 && !/[<>\\u0000-\\u001f]/.test(zoneLabel);

  if (
    access.profile.role !== "promoteur" || access.profile.actif !== true ||
    access.shouldShowAccessStatus || access.linksError || access.pharmaciesError ||
    !uuid.test(candidateId) || !["accept", "dismiss"].includes(decision) ||
    (decision === "accept" && !safeLabel)
  ) {
    redirect("/pharmacie/promoteur/securite?security=review_scope");
  }

  const db = supabaseAdmin();
  const { data: candidate, error: candidateError } = await db
    .from("naxa_security_camera_discovery_candidates")
    .select("id,pharmacie_id,gateway_id,status")
    .eq("id", candidateId)
    .maybeSingle();
  if (candidateError || !candidate || candidate.status !== "pending" ||
    !access.activeLinkIds.has(candidate.pharmacie_id)) {
    redirect("/pharmacie/promoteur/securite?security=review_unavailable");
  }

  const pharmacy = (access.pharmacies ?? []).find((item) => item.id === candidate.pharmacie_id);
  if (!pharmacy || pharmacy.actif !== true || pharmacy.visible_recherche !== true || pharmacy.archivee_le !== null) {
    redirect("/pharmacie/promoteur/securite?security=review_scope");
  }

  const { data: gateway, error: gatewayError } = await db
    .from("naxa_security_gateways")
    .select("id,pharmacie_id,installation_id,tunnel_status")
    .eq("id", candidate.gateway_id)
    .eq("pharmacie_id", candidate.pharmacie_id)
    .maybeSingle();
  if (gatewayError || !gateway || gateway.tunnel_status === "revoked") {
    redirect("/pharmacie/promoteur/securite?security=review_gateway");
  }

  const { data: installation, error: installationError } = await db
    .from("naxa_security_installations")
    .select("status")
    .eq("id", gateway.installation_id)
    .eq("pharmacie_id", candidate.pharmacie_id)
    .maybeSingle();
  if (installationError || !installation || ["suspended", "retired"].includes(installation.status)) {
    redirect("/pharmacie/promoteur/securite?security=review_gateway");
  }

  const expectedStatus = decision === "accept" ? "accepted" : "dismissed";
  const { data: reviewed, error: reviewError } = await db.rpc(
    "naxa_security_review_discovery_candidate",
    {
      p_candidate_id: candidate.id,
      p_decision: decision,
      p_zone_label: decision === "accept" ? zoneLabel : null,
      p_reviewer_id: access.profile.id,
    },
  );
  const reviewPayload = reviewed as { status?: unknown } | null;
  if (reviewError || reviewPayload?.status !== expectedStatus) {
    console.error("[promoteur.security] revue ONVIF atomique", {
      code: reviewError?.code ?? "INVALID_RESULT",
    });
    redirect("/pharmacie/promoteur/securite?security=review_commit");
  }

  revalidatePath("/pharmacie/promoteur/securite");
  revalidatePath("/pharmacie/promoteur");
  redirect(decision === "dismiss"
    ? "/pharmacie/promoteur/securite?security=candidate_dismissed"
    : "/pharmacie/promoteur/securite?security=candidate_accepted");
}

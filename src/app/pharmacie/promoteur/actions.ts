"use server";
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

  const { randomUUID } = await import("node:crypto");
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

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

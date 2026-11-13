"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { supabaseAdmin } from "@/lib/supabase/server";

const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

async function requireAdmin() {
  const { sb } = await requireAdminActive("/admin/prestations");
  return sb;
}

export async function setHomeServiceOfferStatus(form: FormData) {
  const sb = await requireAdmin();
  const offerId = String(form.get("offer_id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!uuid(offerId) || !["draft", "active", "archived"].includes(status)) {
    redirect("/admin/prestations?erreur=validation");
  }
  const { error } = await sb.rpc("admin_set_home_service_offer_status", {
    p_offer_id: offerId,
    p_status: status,
  });
  if (error) redirect("/admin/prestations?erreur=publication");
  const { data: updated } = await sb.from("home_service_offers")
    .select("status").eq("id", offerId).maybeSingle();
  if (updated?.status !== status) redirect("/admin/prestations?erreur=publication");
  revalidatePath("/admin/prestations");
  revalidatePath("/partenaire/prestations");
  revalidatePath("/prestations");
  redirect("/admin/prestations?ok=" + status);
}


export async function setAdminHomeServicePartnerLocation(form: FormData) {
  const sb = await requireAdmin();
  const { data: auth } = await sb.auth.getUser();
  const partnerId = String(form.get("partner_id") ?? "");
  const latText = String(form.get("lat") ?? "").trim();
  const lngText = String(form.get("lng") ?? "").trim();
  const lat = Number(latText);
  const lng = Number(lngText);
  if (!auth.user || !uuid(partnerId) || !latText || !lngText ||
      !Number.isFinite(lat) || lat < -90 || lat > 90 ||
      !Number.isFinite(lng) || lng < -180 || lng > 180) {
    redirect("/admin/prestations?erreur=position");
  }
  const db = supabaseAdmin();
  const { error } = await (db as any).rpc("admin_set_professional_partner_location", {
    p_partner_id: partnerId,
    p_actor_id: auth.user.id,
    p_latitude: lat,
    p_longitude: lng,
  });
  if(error) redirect("/admin/prestations?erreur=position");
  const { data: updated } = await db.from("partners").select("latitude,longitude")
    .eq("id",partnerId).eq("partner_type","professionnel_domicile").maybeSingle();
  if(!updated || Number(updated.latitude)!==lat || Number(updated.longitude)!==lng) redirect("/admin/prestations?erreur=position");
  revalidatePath("/admin/prestations");
  revalidatePath("/partenaire/prestations");
  revalidatePath("/prestations");
  redirect("/admin/prestations?ok=position");
}

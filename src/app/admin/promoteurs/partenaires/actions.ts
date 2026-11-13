"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { supabaseAdmin } from "@/lib/supabase/server";

async function requireAdmin() {
  const { sb } = await requireAdminActive("/admin/promoteurs");
  return sb;
}

export async function validerDossierPartenaire(formData: FormData) {
  const sb = await requireAdmin();
  const id = String(formData.get("partner_id") ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    redirect("/admin/promoteurs?erreur=dossier-partenaire");
  }
  const { error } = await sb.rpc("admin_valider_dossier_partenaire", { p_partner_id: id });
  if (error) {
    const message = (error.message ?? "").toLocaleLowerCase("fr");
    redirect("/admin/promoteurs/partenaires/" + id + "?erreur=" + (message.includes("univers inactif") ? "univers-inactif" : "validation"));
  }
  revalidatePath("/admin/promoteurs");
  revalidatePath("/admin/univers");
  redirect("/admin/promoteurs/partenaires/" + id + "?ok=validation");
}


export async function enregistrerPositionAdminPartenaire(formData: FormData) {
  const { user } = await requireAdminActive("/admin/promoteurs");
  const partnerId = String(formData.get("partner_id") ?? "").trim();
  const rawLat = String(formData.get("latitude") ?? "").trim();
  const rawLng = String(formData.get("longitude") ?? "").trim();
  const latitude = Number(rawLat);
  const longitude = Number(rawLng);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(partnerId)
    || !rawLat || !rawLng || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    redirect("/admin/promoteurs?erreur=position");
  }

  const { error } = await (supabaseAdmin() as any).rpc("admin_set_professional_partner_location", {
    p_partner_id: partnerId,
    p_actor_id: user.id,
    p_latitude: latitude,
    p_longitude: longitude,
  });
  if (error) {
    console.error("[admin.partner.location] mise à jour refusée", { code: error.code, message: error.message });
    redirect("/admin/promoteurs/partenaires/" + partnerId + "?erreur=position");
  }

  revalidatePath("/admin/promoteurs/partenaires/" + partnerId);
  revalidatePath("/prestations");
  revalidatePath("/suivi");
  redirect("/admin/promoteurs/partenaires/" + partnerId + "?ok=position");
}

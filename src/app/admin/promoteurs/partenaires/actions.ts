"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminActive } from "@/lib/admin/require-admin-active";

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

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminActive } from "@/lib/admin/require-admin-active";

export async function confirmerReglementPartenaire(formData: FormData) {
  const { sb, user } = await requireAdminActive("/admin/abonnements-partenaires");
  const id = String(formData.get("reglement_id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id) || formData.get("encaissement_verifie") !== "on") {
    redirect("/admin/abonnements-partenaires?erreur=validation");
  }
  const { error } = await sb.rpc("admin_confirmer_reglement_partenaire", {
    p_reglement: id,
    p_admin: user.id,
  });
  if (error) {
    console.error("[admin.partner.subscription.confirm]", { code: error.code });
    redirect("/admin/abonnements-partenaires?erreur=confirmation");
  }
  revalidatePath("/admin/abonnements-partenaires");
  revalidatePath("/partenaire/abonnement");
  redirect("/admin/abonnements-partenaires?ok=confirme");
}

export async function refuserReglementPartenaire(formData: FormData) {
  const { sb, user } = await requireAdminActive("/admin/abonnements-partenaires");
  const id = String(formData.get("reglement_id") ?? "").trim();
  const motif = String(formData.get("motif") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id) || motif.length < 5 || motif.length > 500) {
    redirect("/admin/abonnements-partenaires?erreur=validation");
  }
  const { error } = await sb.rpc("admin_refuser_reglement_partenaire", {
    p_reglement: id,
    p_admin: user.id,
    p_motif: motif,
  });
  if (error) {
    console.error("[admin.partner.subscription.refuse]", { code: error.code });
    redirect("/admin/abonnements-partenaires?erreur=refus");
  }
  revalidatePath("/admin/abonnements-partenaires");
  revalidatePath("/partenaire/abonnement");
  redirect("/admin/abonnements-partenaires?ok=refuse");
}

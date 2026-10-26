"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

async function requireAdmin() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/admin/promoteurs");
  const { data: profile } = await sb.from("profiles").select("role,actif").eq("id", auth.user.id).maybeSingle();
  if (profile?.role !== "admin" || profile.actif !== true) redirect("/");
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

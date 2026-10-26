"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export async function rattacherServiceBebeMaman(formData: FormData) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/admin");
  const { data: profile } = await sb.from("profiles").select("role,actif").eq("id", auth.user.id).maybeSingle();
  if (profile?.role !== "admin" || profile.actif !== true) redirect("/");

  const pharmacieId = String(formData.get("pharmacie_id") ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pharmacieId)) {
    redirect("/admin?erreur=pharmacie_parrainage");
  }

  const { data: pharmacy, error: pharmacyError } = await sb
    .from("pharmacies").select("id,actif,visible_recherche").eq("id", pharmacieId).maybeSingle();
  if (pharmacyError || !pharmacy || !pharmacy.actif || !pharmacy.visible_recherche) {
    redirect("/admin?erreur=pharmacie_parrainage");
  }

  const { error } = await sb.rpc("admin_set_pharmacie_bebe_maman_service", {
    p_pharmacie_id: pharmacieId,
    p_enabled: true,
  });
  if (error) redirect("/admin?erreur=service_bebe_maman");

  revalidatePath("/admin");
  revalidatePath("/admin/promoteurs");
  revalidatePath("/admin/pharmacies/" + pharmacieId);
  redirect("/admin/pharmacies/" + pharmacieId + "?ok=service");
}

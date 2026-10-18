"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

async function requireAdmin() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/admin/prestations");
  const { data: profile } = await sb.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
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
  revalidatePath("/admin/prestations");
  revalidatePath("/partenaire/prestations");
  revalidatePath("/prestations");
  redirect("/admin/prestations?ok=" + status);
}

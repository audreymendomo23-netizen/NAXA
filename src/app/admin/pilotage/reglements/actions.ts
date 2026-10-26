"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { supabaseAdmin } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function confirmerReglementPromoteur(formData: FormData) {
  const { user } = await requireAdminActive("/admin/pilotage/reglements");
  const id = String(formData.get("reglement_id") ?? "");
  if (!UUID.test(id)) redirect("/admin/pilotage/reglements?erreur=champs");
  const db = supabaseAdmin();
  const { error } = await db.rpc("admin_confirmer_reglement_promoteur", { p_reglement: id, p_admin: user.id });
  if (error) redirect("/admin/pilotage/reglements?erreur=confirmation");
  revalidatePath("/admin/pilotage/reglements");
  revalidatePath("/promoteur/paiements");
  revalidatePath("/notifications");
  redirect("/admin/pilotage/reglements?ok=confirme");
}

export async function contesterReglementPromoteur(formData: FormData) {
  const { user } = await requireAdminActive("/admin/pilotage/reglements");
  const id = String(formData.get("reglement_id") ?? "");
  const motif = String(formData.get("motif") ?? "").trim();
  if (!UUID.test(id) || motif.length < 5 || motif.length > 500) redirect("/admin/pilotage/reglements?erreur=motif");
  const db = supabaseAdmin();
  const { error } = await db.rpc("admin_refuser_reglement_promoteur", { p_reglement: id, p_admin: user.id, p_motif: motif });
  if (error) redirect("/admin/pilotage/reglements?erreur=contestation");
  revalidatePath("/admin/pilotage/reglements");
  revalidatePath("/promoteur/paiements");
  revalidatePath("/notifications");
  redirect("/admin/pilotage/reglements?ok=conteste");
}

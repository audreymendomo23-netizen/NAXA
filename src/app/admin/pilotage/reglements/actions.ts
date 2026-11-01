"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { supabaseAdmin } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function confirmerReglementPromoteur(formData: FormData) {
  const { user } = await requireAdminActive("/admin/pilotage/reglements");
  const id = String(formData.get("reglement_id") ?? "");
  const preuveVerifiee = formData.get("preuve_verifiee") === "on";
  if (!UUID.test(id)) redirect("/admin/pilotage/reglements?erreur=champs");
  if (!preuveVerifiee) redirect("/admin/pilotage/reglements?erreur=verification");
  const db = supabaseAdmin();
  const { data: reglement, error: readError } = await db.from("abonnement_promoteur_reglements")
    .select("id,promoteur_id,statut,preuve_path").eq("id", id).maybeSingle();
  if (readError || !reglement || reglement.statut !== "en_attente") redirect("/admin/pilotage/reglements?erreur=confirmation");

  // Ne jamais confirmer un paiement si l'identité du Promoteur ou son réseau
  // ne peut pas être établi. Les pharmacies peuvent rester inactives :
  // le paiement ne lève aucune suspension indépendante.
  const [{ data: promoter, error: promoterError }, { data: links, error: linksError }] = await Promise.all([
    db.from("profiles").select("id,first_name,last_name,username")
      .eq("id", reglement.promoteur_id).eq("role", "promoteur").maybeSingle(),
    db.from("promoteur_pharmacies").select("pharmacie_id")
      .eq("promoteur_id", reglement.promoteur_id),
  ]);
  const promoterName = promoter
    ? [promoter.first_name, promoter.last_name].filter(Boolean).join(" ") || promoter.username
    : null;
  const pharmacyIds = [...new Set((links ?? []).map(link => link.pharmacie_id).filter(Boolean))];
  const { data: pharmacies, error: pharmaciesError } = pharmacyIds.length
    ? await db.from("pharmacies").select("id,nom").in("id", pharmacyIds)
    : { data: [], error: null };
  if (promoterError || linksError || pharmaciesError || !promoterName ||
      !pharmacyIds.length || new Set((pharmacies ?? []).map(pharmacy => pharmacy.id)).size !== pharmacyIds.length || (pharmacies ?? []).some(pharmacy => !pharmacy.nom?.trim())) {
    redirect("/admin/pilotage/reglements?erreur=dossier");
  }

  const { data: preuve } = await db.storage.from("preuves-reglements-promoteurs").createSignedUrl(reglement.preuve_path, 600);
  if (!preuve?.signedUrl) redirect("/admin/pilotage/reglements?erreur=preuve");
  const { error } = await db.rpc("admin_confirmer_reglement_promoteur", { p_reglement: id, p_admin: user.id });
  if (error) redirect("/admin/pilotage/reglements?erreur=confirmation");
  revalidatePath("/admin/pilotage/reglements");
  revalidatePath("/admin/pilotage/validite");
  revalidatePath("/pharmacie/promoteur");
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

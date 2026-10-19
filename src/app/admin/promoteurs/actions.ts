"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

async function exigerAdmin() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/admin/promoteurs");
  const { data: profile, error } = await sb.from("profiles").select("role").eq("id", auth.user.id).single();
  if (error || profile?.role !== "admin") redirect("/");
  return auth.user.id;
}

export async function validerDossierPharmacie(formData: FormData) {
  const adminId = await exigerAdmin();
  const pharmacyId = String(formData.get("pharmacie_id") ?? "").trim();
  const attestation = formData.get("autorisations_verifiees") === "on";
  if (!pharmacyId || !attestation) redirect("/admin/promoteurs?erreur=verification");

  const db = supabaseAdmin();
  const { data: pharmacy, error: pharmacyReadError } = await db
    .from("pharmacies")
    .select("id,actif,visible_recherche")
    .eq("id", pharmacyId)
    .maybeSingle();
  if (pharmacyReadError || !pharmacy) redirect("/admin/promoteurs?erreur=pharmacie");

  const { data: link, error: linkError } = await db
    .from("promoteur_pharmacies")
    .select("promoteur_id,actif")
    .eq("pharmacie_id", pharmacyId)
    .maybeSingle();
  if (linkError || !link) redirect("/admin/promoteurs?erreur=rattachement");

  const { data: promoter, error: promoterError } = await db
    .from("profiles")
    .select("id,role,architecture_code")
    .eq("id", link.promoteur_id)
    .maybeSingle();
  if (promoterError || promoter?.role !== "promoteur" || !promoter.architecture_code) {
    redirect("/admin/promoteurs?erreur=promoteur");
  }

  const [{ data: convention, error: conventionError }, { data: subscription, error: subscriptionError }, { data: architecture, error: architectureError }] = await Promise.all([
    db.from("conventions_promoteurs").select("id,architecture_code").eq("promoteur_id", promoter.id).maybeSingle(),
    db.from("abonnements_promoteurs").select("id,convention_id").eq("promoteur_id", promoter.id).maybeSingle(),
    db.from("naxa_architectures").select("code,max_responsables,max_caisses").eq("code", promoter.architecture_code).eq("active", true).maybeSingle(),
  ]);
  if (conventionError || subscriptionError || architectureError || !convention || !subscription || !architecture ||
      subscription.convention_id !== convention.id || convention.architecture_code !== promoter.architecture_code) {
    redirect("/admin/promoteurs?erreur=contrat");
  }

  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const expiry = new Date(today);
  expiry.setUTCDate(expiry.getUTCDate() + 14);
  const end = expiry.toISOString().slice(0, 10);

  // Le dernier changement rend la pharmacie visible : les prérequis sont vérifiés avant.
  const { error: contractUpdateError } = await db.from("conventions_promoteurs")
    .update({ statut: "active", date_expiration: end })
    .eq("id", convention.id);
  if (contractUpdateError) redirect("/admin/promoteurs?erreur=contrat");

  const { error: subscriptionUpdateError } = await db.from("abonnements_promoteurs")
    .update({ statut: "actif", debut: start, echeance: end })
    .eq("id", subscription.id);
  if (subscriptionUpdateError) redirect("/admin/promoteurs?erreur=abonnement");

  const { error: architectureUpdateError } = await db.from("pharmacie_architectures").upsert({
    pharmacie_id: pharmacyId,
    architecture_code: architecture.code,
    assigned_by: adminId,
    active: true,
    max_responsables: architecture.max_responsables ?? 0,
    max_caisses: architecture.max_caisses,
  }, { onConflict: "pharmacie_id" });
  if (architectureUpdateError) redirect("/admin/promoteurs?erreur=architecture");

  const { error: promoterUpdateError } = await db.from("profiles")
    .update({ actif: true, pharmacie_id: pharmacyId, architecture_code: architecture.code })
    .eq("id", promoter.id)
    .eq("role", "promoteur");
  if (promoterUpdateError) redirect("/admin/promoteurs?erreur=promoteur");

  const { error: linkUpdateError } = await db.from("promoteur_pharmacies")
    .update({ actif: true })
    .eq("promoteur_id", promoter.id)
    .eq("pharmacie_id", pharmacyId);
  if (linkUpdateError) {
    await db.from("profiles").update({ actif: false }).eq("id", promoter.id);
    redirect("/admin/promoteurs?erreur=rattachement");
  }

  const { error: pharmacyUpdateError } = await db.from("pharmacies")
    .update({ actif: true, visible_recherche: true })
    .eq("id", pharmacyId);
  if (pharmacyUpdateError) {
    await db.from("promoteur_pharmacies").update({ actif: false }).eq("promoteur_id", promoter.id).eq("pharmacie_id", pharmacyId);
    await db.from("profiles").update({ actif: false }).eq("id", promoter.id);
    redirect("/admin/promoteurs?erreur=activation");
  }

  redirect("/admin/promoteurs?ok=validation");
}

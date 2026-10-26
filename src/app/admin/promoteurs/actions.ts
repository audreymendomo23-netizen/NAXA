"use server";

import { redirect } from "next/navigation";
import { requireAdminActive } from "@/lib/admin/require-admin-active";

async function exigerAdmin() {
  const { sb } = await requireAdminActive("/admin/promoteurs");
  return sb;
}

export async function mettreAJourPiecesRecues(formData: FormData) {
  const db = await exigerAdmin();
  const { data: auth } = await db.auth.getUser();
  const pharmacyId = String(formData.get("pharmacie_id") ?? "").trim();
  if (!pharmacyId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pharmacyId)) {
    redirect("/admin/promoteurs?erreur=documents");
  }

  const { error } = await db.from("pharmacie_documents_recus").upsert({
    pharmacie_id: pharmacyId,
    piece_existence_legale: formData.get("piece_existence_legale") === "oui",
    registre_commerce: formData.get("registre_commerce") === "oui",
    niu: formData.get("niu") === "oui",
    attestation_non_redevance: formData.get("attestation_non_redevance") === "oui",
    plan_localisation: formData.get("plan_localisation") === "oui",
    cni_promoteur: formData.get("cni_promoteur") === "oui",
    mis_a_jour_par: auth.user?.id ?? null,
    mis_a_jour_le: new Date().toISOString(),
  }, { onConflict: "pharmacie_id" });

  if (error) redirect("/admin/promoteurs?erreur=documents");
  redirect("/admin/promoteurs?ok=documents");
}

export async function validerDossierPharmacie(formData: FormData) {
  const db = await exigerAdmin();
  const pharmacyId = String(formData.get("pharmacie_id") ?? "").trim();
  const attestation = formData.get("autorisations_verifiees") === "on";
  if (!pharmacyId || !attestation) redirect("/admin/promoteurs?erreur=verification");

  // Une RPC PostgreSQL unique exécute les contrôles et toutes les écritures dans une transaction.
  // En cas d'erreur, PostgreSQL annule toute l'opération : aucun rollback applicatif partiel.
  const { error } = await db.rpc("admin_valider_dossier_pharmacie", {
    p_pharmacie: pharmacyId,
    p_autorisations_verifiees: attestation,
  });

  if (error) {
    const message = (error.message ?? "").toLocaleLowerCase("fr");
    if (message.includes("autorisation")) redirect("/admin/promoteurs?erreur=verification");
    if (message.includes("pharmacie introuvable")) redirect("/admin/promoteurs?erreur=pharmacie");
    if (message.includes("rattachement")) redirect("/admin/promoteurs?erreur=rattachement");
    if (message.includes("promoteur")) redirect("/admin/promoteurs?erreur=promoteur");
    if (message.includes("dossier administratif")) redirect("/admin/promoteurs?erreur=dossier-incomplet");
    if (message.includes("convention") || message.includes("abonnement") || message.includes("architecture")) {
      redirect("/admin/promoteurs?erreur=contrat");
    }
    if (message.includes("déjà actif")) redirect("/admin/promoteurs?erreur=deja-active");
    if (message.includes("accès réservé")) redirect("/");
    redirect("/admin/promoteurs?erreur=validation-impossible");
  }

  redirect("/admin/promoteurs?ok=validation");
}

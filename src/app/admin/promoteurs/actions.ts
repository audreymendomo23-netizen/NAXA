"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

async function exigerAdmin() {
  const db = supabaseServer();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/admin/promoteurs");
  const { data: profile, error } = await db.from("profiles").select("role").eq("id", auth.user.id).single();
  if (error || profile?.role !== "admin") redirect("/");
  return db;
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

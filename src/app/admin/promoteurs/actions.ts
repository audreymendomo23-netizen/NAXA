"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdminActive } from "@/lib/admin/require-admin-active";

const PHARMACY_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUIRED_DOCUMENT_TYPES = ["existence_legale","registre_commerce","niu","attestation_non_redevance","plan_localisation","cni_promoteur"] as const;

function redirectValidationPharmacie(pharmacyId: string, retourFiche: boolean, query: string): never {
  const destination = retourFiche && PHARMACY_UUID.test(pharmacyId)
    ? `/admin/pharmacies/${pharmacyId}`
    : "/admin/promoteurs";
  redirect(`${destination}?${query}`);
}

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
  const pharmacyId = String(formData.get("pharmacie_id") ?? "").trim();
  const retourFiche = formData.get("retour") === "fiche" && PHARMACY_UUID.test(pharmacyId);
  const { sb } = await requireAdminActive(
    retourFiche ? `/admin/pharmacies/${pharmacyId}` : "/admin/promoteurs",
  );
  const attestation = formData.get("autorisations_verifiees") === "on";
  if (!PHARMACY_UUID.test(pharmacyId)) {
    return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=pharmacie");
  }
  if (!attestation) {
    return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=verification");
  }

  // La validation initiale ne doit pas servir à réinitialiser l'essai d'un Promoteur déjà exploité.
  const adminDb = supabaseAdmin();
  const [{ data: pharmacy, error: pharmacyReadError }, { data: links, error: linksReadError }] = await Promise.all([
    adminDb.from("pharmacies").select("id,actif,visible_recherche").eq("id", pharmacyId).maybeSingle(),
    adminDb.from("promoteur_pharmacies").select("promoteur_id,actif").eq("pharmacie_id", pharmacyId),
  ]);
  if (pharmacyReadError || linksReadError) {
    return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=validation-impossible");
  }
  if (!pharmacy) {
    return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=pharmacie");
  }
  if (pharmacy.actif !== false || pharmacy.visible_recherche !== false) {
    return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=validation-etat");
  }
  if (!links || links.length !== 1) {
    return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=rattachement");
  }
  if (links[0].actif !== false) {
    return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=validation-etat");
  }
  const { data: promoteur, error: promoteurError } = await adminDb
    .from("profiles")
    .select("role,actif,pharmacie_id")
    .eq("id", links[0].promoteur_id)
    .maybeSingle();
  if (promoteurError) {
    return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=validation-impossible");
  }
  if (!promoteur || promoteur.role !== "promoteur" || promoteur.pharmacie_id !== pharmacyId) {
    return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=promoteur");
  }
  if (promoteur.actif !== false) {
    return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=validation-etat");
  }

  // Les cases « documents reçus » sont informatives. Seuls les fichiers réellement déposés
  // et validés constituent ici le contrôle documentaire ; l'attestation Admin reste obligatoire.
  const { data: documents, error: documentsError } = await adminDb.from("pharmacie_documents")
    .select("type_document,statut_validation,recu_le,version,id")
    .eq("pharmacie_id", pharmacyId)
    .order("recu_le", { ascending: false })
    .order("version", { ascending: false })
    .order("id", { ascending: false });
  if (documentsError) {
    return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=documents-indisponibles");
  }
  const latestStatusByType = new Map<string, string>();
  for (const document of documents ?? []) {
    if (!latestStatusByType.has(document.type_document)) {
      latestStatusByType.set(document.type_document, document.statut_validation);
    }
  }
  if (REQUIRED_DOCUMENT_TYPES.some((type) => latestStatusByType.get(type) !== "valide")) {
    return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=documents-validation");
  }

  // La RPC recontrôle les états sous verrou avant toute écriture.
  const { error } = await sb.rpc("admin_valider_dossier_pharmacie", {
    p_pharmacie: pharmacyId,
    p_autorisations_verifiees: attestation,
  });
  if (error) {
    const message = (error.message ?? "").toLocaleLowerCase("fr");
    if (message.includes("autorisation")) return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=verification");
    if (message.includes("pharmacie introuvable")) return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=pharmacie");
    if (message.includes("rattachement")) return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=rattachement");
    if (message.includes("promoteur")) return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=promoteur");
    if (message.includes("dossier administratif")) return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=dossier-incomplet");
    if (message.includes("document requis absent ou non validé")) return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=documents-validation");
    if (message.includes("non en attente")) return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=validation-etat");
    if (message.includes("convention") || message.includes("abonnement") || message.includes("architecture")) {
      return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=contrat");
    }
    if (message.includes("déjà actif")) return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=deja-active");
    if (message.includes("accès réservé")) redirect("/");
    return redirectValidationPharmacie(pharmacyId, retourFiche, "erreur=validation-impossible");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/promoteurs");
  revalidatePath(`/admin/pharmacies/${pharmacyId}`);
  revalidatePath("/admin/pilotage/validite");
  return redirectValidationPharmacie(pharmacyId, retourFiche, "ok=validation");
}


export async function suspendrePromoteurDisciplinaire(formData: FormData) {
  const db = await exigerAdmin();
  const promoteurId = String(formData.get("promoteur_id") ?? "").trim();
  const observations = String(formData.get("observations") ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(promoteurId)) {
    redirect("/admin/promoteurs?erreur=suspension");
  }
  const { error } = await db.rpc("admin_suspendre_promoteur_disciplinaire", {
    p_promoteur: promoteurId,
    p_observations: observations || null,
  });
  if (error) redirect("/admin/promoteurs?erreur=suspension");
  redirect("/admin/promoteurs?ok=suspension");
}

export async function leverSuspensionPromoteur(formData: FormData) {
  const db = await exigerAdmin();
  const suspensionId = String(formData.get("suspension_id") ?? "").trim();
  const motif = String(formData.get("motif_levee") ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(suspensionId)) {
    redirect("/admin/promoteurs?erreur=levee-suspension");
  }
  const { error } = await db.rpc("admin_lever_suspension_promoteur", {
    p_suspension: suspensionId,
    p_motif: motif || null,
  });
  if (error) redirect("/admin/promoteurs?erreur=levee-suspension");
  redirect("/admin/promoteurs?ok=levee-suspension");
}

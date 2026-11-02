"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

const CANAUX = new Set(["orange_money", "mtn_momo", "virement"]);

export async function soumettrePaiementPromoteur(formData: FormData) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/connexion");
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "promoteur") redirect("/pharmacie/promoteur");

  const montant = Number(formData.get("montant"));
  const canal = String(formData.get("canal") ?? "");
  const comptePayeur = String(formData.get("compte_payeur") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const payeLeRaw = String(formData.get("paye_le") ?? "").trim();
  const preuve = formData.get("preuve");

  if (!Number.isSafeInteger(montant) || montant <= 0 || !CANAUX.has(canal)) redirect("/promoteur/paiements?erreur=champs");
  if (comptePayeur.length < 3 || comptePayeur.length > 120) redirect("/promoteur/paiements?erreur=compte");
  if (reference.length < 3 || reference.length > 160) redirect("/promoteur/paiements?erreur=reference");
  if (!payeLeRaw) redirect("/promoteur/paiements?erreur=date");
  const payeLeDate = new Date(payeLeRaw + ":00+01:00");
  if (!Number.isFinite(payeLeDate.getTime()) || payeLeDate.getTime() > Date.now() + 5 * 60_000) redirect("/promoteur/paiements?erreur=date");
  if (!(preuve instanceof File) || preuve.size <= 0 || preuve.size > 25 * 1024 * 1024) redirect("/promoteur/paiements?erreur=preuve");

  const extensions: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  const extension = extensions[preuve.type];
  if (!extension) redirect("/promoteur/paiements?erreur=format");

  const db = supabaseAdmin();
  const proofPath = user.id + "/" + crypto.randomUUID() + "." + extension;
  const { error: uploadError } = await db.storage.from("preuves-reglements-promoteurs").upload(proofPath, preuve, {
    contentType: preuve.type,
    upsert: false,
  });
  if (uploadError) redirect("/promoteur/paiements?erreur=upload");

  const { error } = await db.rpc("promoteur_soumettre_reglement", {
    p_promoteur: user.id,
    p_montant: montant,
    p_canal: canal,
    p_canal_autre: null,
    p_compte_payeur: comptePayeur,
    p_reference: reference || null,
    p_paye_le: payeLeDate.toISOString(),
    p_preuve_path: proofPath,
  });
  if (error) {
    const bucket = db.storage.from("preuves-reglements-promoteurs");
    let proofRemoved = false;
    let cleanupFailure = false;

    // Compensation contrôlée : deux tentatives de suppression, puis lecture du
    // dossier pour vérifier l'absence réelle de l'objet (pas seulement l'absence d'erreur).
    for (let attempt = 0; attempt < 2 && !proofRemoved; attempt += 1) {
      try {
        const { error: removeError } = await bucket.remove([proofPath]);
        if (removeError) cleanupFailure = true;
        const folder = proofPath.slice(0, proofPath.lastIndexOf("/"));
        const filename = proofPath.slice(proofPath.lastIndexOf("/") + 1);
        const { data: remaining, error: listError } = await bucket.list(folder, {
          search: filename,
          limit: 10,
        });
        if (!listError && !(remaining ?? []).some(file => file.name === filename)) {
          proofRemoved = true;
        } else if (listError) {
          cleanupFailure = true;
        }
      } catch {
        cleanupFailure = true;
      }
    }

    if (!proofRemoved) {
      // Trace durable pour l'Administration lorsque la compensation Storage échoue.
      const { error: journalError } = await db.from("journal_admin").insert({
        admin_profile_id: null,
        action: "reglement_preuve_orpheline",
        cible_type: "promoteur",
        cible_id: user.id,
        motif: "Nettoyage Storage non confirmé après refus de la soumission du règlement",
        detail: {
          bucket: "preuves-reglements-promoteurs",
          storage_path: proofPath,
          rpc_error_code: error.code ?? "unknown",
          cleanup_error_observed: cleanupFailure,
        },
      });
      if (journalError) {
        console.error("[promoteur-payment] orphan-proof audit failed", {
          promoteurId: user.id,
          rpcErrorCode: error.code ?? "unknown",
          journalErrorCode: journalError.code ?? "unknown",
        });
      }
      redirect("/promoteur/paiements?erreur=nettoyage_preuve");
    }

    const message = error.message.toLowerCase();
    const code = message.includes("attente") ? "deja_attente" : message.includes("montant") ? "montant" : "soumission";
    redirect("/promoteur/paiements?erreur=" + code);
  }

  revalidatePath("/promoteur/paiements");
  revalidatePath("/admin/pilotage/reglements");
  revalidatePath("/notifications");
  redirect("/promoteur/paiements?ok=soumis");
}

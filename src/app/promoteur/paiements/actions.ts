"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

const CANAUX = new Set(["orange_money", "mtn_momo", "virement"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requirePromoteur() {
  const sb = supabaseServer();
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) redirect("/connexion");
  const { data: profile, error: profileError } = await sb.from("profiles")
    .select("role").eq("id", user.id).maybeSingle();
  if (profileError || profile?.role !== "promoteur") redirect("/pharmacie/promoteur");
  return user;
}

export async function soumettrePaiementPromoteur(formData: FormData) {
  const user = await requirePromoteur();
  const montant = Number(formData.get("montant"));
  const canal = String(formData.get("canal") ?? "");
  const comptePayeur = String(formData.get("compte_payeur") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const payeLeRaw = String(formData.get("paye_le") ?? "").trim();

  if (!Number.isSafeInteger(montant) || montant <= 0 || !CANAUX.has(canal)) {
    redirect("/promoteur/paiements?erreur=champs");
  }
  if (comptePayeur.length < 3 || comptePayeur.length > 120) {
    redirect("/promoteur/paiements?erreur=compte");
  }
  if (reference.length < 3 || reference.length > 160) {
    redirect("/promoteur/paiements?erreur=reference");
  }
  if (!payeLeRaw) redirect("/promoteur/paiements?erreur=date");
  const payeLeDate = new Date(payeLeRaw + ":00+01:00");
  if (!Number.isFinite(payeLeDate.getTime()) || payeLeDate.getTime() > Date.now() + 5 * 60_000) {
    redirect("/promoteur/paiements?erreur=date");
  }

  const db = supabaseAdmin();
  const { error } = await db.rpc("promoteur_soumettre_reglement", {
    p_promoteur: user.id,
    p_montant: montant,
    p_canal: canal,
    p_canal_autre: null,
    p_compte_payeur: comptePayeur,
    p_reference: reference,
    p_paye_le: payeLeDate.toISOString(),
    p_preuve_path: null,
  });
  if (error) {
    const message = error.message.toLowerCase();
    const code = message.includes("attente") ? "deja_attente"
      : message.includes("montant") ? "montant"
      : message.includes("destination") ? "destination"
      : "soumission";
    redirect("/promoteur/paiements?erreur=" + code);
  }

  revalidatePath("/promoteur/paiements");
  revalidatePath("/admin/pilotage/reglements");
  revalidatePath("/notifications");
  redirect("/promoteur/paiements?ok=soumis");
}

export async function deposerPreuveComplementaire(formData: FormData) {
  const user = await requirePromoteur();
  const id = String(formData.get("reglement_id") ?? "");
  const preuve = formData.get("preuve");
  if (!UUID.test(id) || !(preuve instanceof File) || preuve.size <= 0 || preuve.size > 25 * 1024 * 1024) {
    redirect("/promoteur/paiements?erreur=preuve");
  }
  const extensions: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensions[preuve.type];
  if (!extension) redirect("/promoteur/paiements?erreur=format");

  const db = supabaseAdmin();
  const { data: row, error: readError } = await db.from("abonnement_promoteur_reglements")
    .select("id,statut,declared_at,preuve_path")
    .eq("id", id)
    .eq("promoteur_id", user.id)
    .maybeSingle();
  if (readError || !row || !row.declared_at ||
      !["en_attente", "non_confirme"].includes(row.statut)) {
    redirect("/promoteur/paiements?erreur=preuve_indisponible");
  }
  const declaredAt = new Date(row.declared_at).getTime();
  if (!Number.isFinite(declaredAt) || Date.now() < declaredAt + 60 * 60 * 1000) {
    redirect("/promoteur/paiements?erreur=preuve_trop_tot");
  }

  const proofPath = user.id + "/" + crypto.randomUUID() + "." + extension;
  const bucket = db.storage.from("preuves-reglements-promoteurs");
  const { error: uploadError } = await bucket.upload(proofPath, preuve, {
    contentType: preuve.type,
    upsert: false,
  });
  if (uploadError) redirect("/promoteur/paiements?erreur=upload");

  const { data: updated, error: updateError } = await db.from("abonnement_promoteur_reglements")
    .update({ preuve_path: proofPath, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("promoteur_id", user.id)
    .in("statut", ["en_attente", "non_confirme"])
    .select("id")
    .maybeSingle();

  if (updateError || !updated) {
    // A transport error can arrive after Postgres committed the UPDATE.
    // Never delete a proof until the database confirms that it is unreferenced.
    const { data: persisted, error: verifyError } = await db.from("abonnement_promoteur_reglements")
      .select("id,preuve_path")
      .eq("id", id)
      .eq("promoteur_id", user.id)
      .maybeSingle();

    if (!verifyError && persisted?.preuve_path === proofPath) {
      revalidatePath("/promoteur/paiements");
      revalidatePath("/admin/pilotage/reglements");
      redirect("/promoteur/paiements?ok=preuve");
    }

    // If database state cannot be established, preserve the object and raise
    // an auditable incident instead of risking a broken DB -> Storage link.
    if (verifyError) {
      try {
        const { error: auditError } = await db.from("audit_log").insert({
          actor_id: user.id,
          action: "reglement_preuve_orpheline",
          entity_type: "abonnement_promoteur_reglement",
          entity_id: id,
          metadata: {
            storage_path: proofPath,
            storage_bucket: "preuves-reglements-promoteurs",
            database_state: "uncertain",
            update_error: updateError?.message ?? null,
            verification_error: verifyError.message,
          },
        });
        if (auditError) console.error("NAXA: impossible de journaliser la preuve de règlement à vérifier", auditError.message);
      } catch (auditFailure) {
        console.error("NAXA: exception pendant la journalisation de preuve de règlement", auditFailure);
      }
      redirect("/promoteur/paiements?erreur=nettoyage_preuve");
    }

    let proofRemoved = false;
    const folder = user.id;
    const filename = proofPath.split("/").pop() ?? proofPath;
    for (let attempt = 0; attempt < 2 && !proofRemoved; attempt += 1) {
      try {
        await bucket.remove([proofPath]);
        const { data: remaining, error: listError } = await bucket.list(folder, { search: filename });
        proofRemoved = !listError && !(remaining ?? []).some(file => file.name === filename);
      } catch {
        proofRemoved = false;
      }
    }

    if (!proofRemoved) {
      try {
        const { error: auditError } = await db.from("audit_log").insert({
          actor_id: user.id,
          action: "reglement_preuve_orpheline",
          entity_type: "abonnement_promoteur_reglement",
          entity_id: id,
          metadata: {
            storage_path: proofPath,
            storage_bucket: "preuves-reglements-promoteurs",
            cleanup_attempts: 2,
            database_state: "not_referenced",
            update_error: updateError?.message ?? null,
          },
        });
        if (auditError) console.error("NAXA: impossible de journaliser la preuve de règlement orpheline", auditError.message);
      } catch (auditFailure) {
        console.error("NAXA: exception pendant la journalisation de preuve orpheline", auditFailure);
      }
      redirect("/promoteur/paiements?erreur=nettoyage_preuve");
    }

    redirect("/promoteur/paiements?erreur=preuve_indisponible");
  }
  if (row.preuve_path) {
    await bucket.remove([row.preuve_path]);
  }

  revalidatePath("/promoteur/paiements");
  revalidatePath("/admin/pilotage/reglements");
  redirect("/promoteur/paiements?ok=preuve");
}

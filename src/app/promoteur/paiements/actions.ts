"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";
import { parsePromoteurPaymentSms, validatePromoteurPaymentSms } from "@/lib/promoteurPaymentSms";
import { interpretPromoteurPaymentSms } from "@/lib/promoteurPaymentSmsAI";

const CANAUX = new Set(["orange_money", "mtn_momo"]);
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
  const referenceSaisie = String(formData.get("reference") ?? "").trim();
  const payeLeRaw = String(formData.get("paye_le") ?? "").trim();
  const smsMessage = String(formData.get("sms_message") ?? "").trim().slice(0, 8000);
  const smsSender = String(formData.get("sms_expediteur") ?? "").trim().slice(0, 80);
  const preuve = formData.get("preuve");

  if (!Number.isSafeInteger(montant) || montant <= 0 || !CANAUX.has(canal)) redirect("/promoteur/paiements?erreur=champs");
  if (comptePayeur.length < 3 || comptePayeur.length > 120) redirect("/promoteur/paiements?erreur=compte");
  if (!payeLeRaw) redirect("/promoteur/paiements?erreur=date");
  const payeLeDate = new Date(payeLeRaw + ":00+01:00");
  if (!Number.isFinite(payeLeDate.getTime()) || payeLeDate.getTime() > Date.now() + 5 * 60_000 ||
      payeLeDate.getTime() < Date.now() - 24 * 60 * 60_000) redirect("/promoteur/paiements?erreur=date");

  const parsed = smsMessage
    ? (parsePromoteurPaymentSms(smsMessage, canal as "orange_money" | "mtn_momo", smsSender) ??
       await interpretPromoteurPaymentSms(smsMessage, canal as "orange_money" | "mtn_momo", smsSender))
    : null;
  const transactionReference = (parsed?.reference ?? referenceSaisie).trim();
  if (transactionReference.length < 3 || transactionReference.length > 160) redirect("/promoteur/paiements?erreur=reference");

  const db = supabaseAdmin();
  const [{ data: destination }, { data: subscription }] = await Promise.all([
    db.from("naxa_payment_destinations")
      .select("beneficiaire,reference_destination")
      .eq("canal", canal).eq("actif", true).maybeSingle(),
    db.from("abonnements_promoteurs")
      .select("montant_mensuel").eq("promoteur_id", user.id).maybeSingle(),
  ]);
  if (!destination || !subscription || subscription.montant_mensuel !== montant) redirect("/promoteur/paiements?erreur=montant");

  const validation = validatePromoteurPaymentSms(parsed, {
    channel: canal as "orange_money" | "mtn_momo",
    amount: montant,
    payerNumber: comptePayeur,
    reference: referenceSaisie || parsed?.reference,
    paidAt: payeLeDate.toISOString(),
    merchantName: destination.beneficiaire,
    merchantReference: destination.reference_destination,
  }, { provenance: "manual_submission" });

  const verificationDetails = {
    level: 3,
    status: "manual_review",
    parser: parsed?.parser ?? "none",
    quality: parsed?.quality ?? "unrecognized",
    direction: parsed?.direction ?? null,
    success: parsed?.success ?? false,
    amount: parsed?.amount ?? null,
    extractedReference: parsed?.reference ?? null,
    extractedPayerNumber: parsed?.payerNumber ?? null,
    extractedMerchantNumber: parsed?.merchantNumber ?? null,
    extractedMerchantLabel: parsed?.merchantLabel ?? null,
    providerOccurredAt: parsed?.occurredAt ?? null,
    smsSenderId: smsSender || null,
    senderLabelMatchedCollectionFilter: parsed?.senderTrusted ?? false,
    reasons: validation.reasons,
    manualEvidence: true,
    rawSmsStored: false,
  };

  const extensions: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  let proofPath: string | null = null;
  if (preuve instanceof File && preuve.size > 0) {
    if (preuve.size > 25 * 1024 * 1024 || !extensions[preuve.type]) redirect("/promoteur/paiements?erreur=preuve");
    proofPath = user.id + "/" + crypto.randomUUID() + "." + extensions[preuve.type];
    const { error: uploadError } = await db.storage.from("preuves-reglements-promoteurs").upload(proofPath, preuve, {
      contentType: preuve.type,
      upsert: false,
    });
    if (uploadError) redirect("/promoteur/paiements?erreur=upload");
  }

  const { data: reglementId, error } = await db.rpc("promoteur_soumettre_reglement", {
    p_promoteur: user.id,
    p_montant: montant,
    p_canal: canal,
    p_canal_autre: null,
    p_compte_payeur: comptePayeur,
    p_reference: transactionReference,
    p_paye_le: payeLeDate.toISOString(),
    p_preuve_path: proofPath,
    p_verification_details: verificationDetails,
  });
  if (error || !reglementId) {
    if (proofPath) {
      const { data: persisted, error: verifyError } = await db.from("abonnement_promoteur_reglements")
        .select("id,preuve_path").eq("promoteur_id", user.id).eq("reference", transactionReference).maybeSingle();
      if (!verifyError && persisted?.preuve_path !== proofPath) {
        await db.storage.from("preuves-reglements-promoteurs").remove([proofPath]);
      }
    }
    const message = (error?.message ?? "").toLowerCase();
    const code = message.includes("reference") && (message.includes("utilisee") || message.includes("unique")) ? "reference_deja_utilisee"
      : message.includes("attente") ? "deja_attente"
      : message.includes("montant") ? "montant"
      : message.includes("date") || message.includes("fenetre") ? "date"
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
    .select("id,statut,declared_at,verification_deadline_at,preuve_path")
    .eq("id", id)
    .eq("promoteur_id", user.id)
    .maybeSingle();
  if (readError || !row || !row.declared_at ||
      !["en_attente", "non_confirme"].includes(row.statut)) {
    redirect("/promoteur/paiements?erreur=preuve_indisponible");
  }
  const deadline = row.verification_deadline_at ? new Date(row.verification_deadline_at).getTime() : 0;
  if (!Number.isFinite(deadline) || Date.now() > deadline) {
    redirect("/promoteur/paiements?erreur=preuve_indisponible");
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

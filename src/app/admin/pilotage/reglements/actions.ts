"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { supabaseAdmin } from "@/lib/supabase/server";
import { parsePromoteurPaymentSms, validatePromoteurPaymentSms } from "@/lib/promoteurPaymentSms";
import { interpretPromoteurPaymentSms } from "@/lib/promoteurPaymentSmsAI";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function confirmerReglementPromoteur(formData: FormData) {
  const { user } = await requireAdminActive("/admin/pilotage/reglements");
  const id = String(formData.get("reglement_id") ?? "");
  const preuveVerifiee = formData.get("preuve_verifiee") === "on";
  if (!UUID.test(id)) redirect("/admin/pilotage/reglements?erreur=champs");
  if (!preuveVerifiee) redirect("/admin/pilotage/reglements?erreur=verification");
  const db = supabaseAdmin();
  const { data: reglement, error: readError } = await db.from("abonnement_promoteur_reglements")
    .select("id,promoteur_id,statut").eq("id", id).maybeSingle();
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

  // La preuve complémentaire est facultative ; l’Administrateur confirme après rapprochement externe.
  const { error } = await db.rpc("admin_confirmer_reglement_promoteur", { p_reglement: id, p_admin: user.id });
  if (error) redirect("/admin/pilotage/reglements?erreur=confirmation");
  const { error: verificationUpdateError } = await db.from("abonnement_promoteur_reglements")
    .update({ verification_status: "confirmed_admin", updated_at: new Date().toISOString() })
    .eq("id", id).eq("statut", "confirme");
  if (verificationUpdateError) console.error("NAXA: impossible d’actualiser le statut de vérification du règlement", verificationUpdateError.message);
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
  await db.from("abonnement_promoteur_reglements")
    .update({ verification_status: "invalid", updated_at: new Date().toISOString() })
    .eq("id", id).eq("statut", "conteste");
  revalidatePath("/admin/pilotage/reglements");
  revalidatePath("/promoteur/paiements");
  revalidatePath("/notifications");
  redirect("/admin/pilotage/reglements?ok=conteste");
}


export async function analyserPreuvePaiementOcr(
  reglementId: string,
  ocrText: string,
  confidence: number
): Promise<{
  ok: boolean;
  message: string;
  extracted?: {
    direction: string | null;
    amount: number | null;
    reference: string | null;
    payerNumber: string | null;
    merchantNumber: string | null;
    occurredAt: string | null;
    parser: string;
    quality: string;
  };
  reasons?: string[];
}> {
  const { user } = await requireAdminActive("/admin/pilotage/reglements");
  if (!UUID.test(reglementId) || typeof ocrText !== "string" ||
      ocrText.trim().length < 12 || ocrText.length > 12000 ||
      !Number.isFinite(confidence) || confidence < 0 || confidence > 100) {
    return { ok: false, message: "Texte OCR ou dossier de paiement invalide." };
  }

  const db = supabaseAdmin();
  const { data: row, error: readError } = await db.from("abonnement_promoteur_reglements")
    .select("id,promoteur_id,montant,canal,compte_payeur,reference,paye_le,statut,destination_snapshot,verification_level,verification_details,verification_deadline_at")
    .eq("id", reglementId).maybeSingle();
  if (readError || !row || row.statut !== "en_attente" ||
      !["orange_money", "mtn_momo"].includes(row.canal) ||
      !row.verification_deadline_at || new Date(row.verification_deadline_at).getTime() <= Date.now()) {
    return { ok: false, message: "Ce règlement n'est plus disponible pour l'analyse OCR." };
  }

  const senderMatch = ocrText.match(/\b(OrangeMoney|MobileMoney)\b/i);
  const sender = senderMatch?.[1] ?? null;
  const parsed = parsePromoteurPaymentSms(ocrText, row.canal, sender) ??
    await interpretPromoteurPaymentSms(ocrText, row.canal, sender);

  const destination = row.destination_snapshot as {
    beneficiaire?: string;
    reference_destination?: string;
  } | null;
  const validation = validatePromoteurPaymentSms(parsed, {
    channel: row.canal,
    amount: row.montant,
    payerNumber: row.compte_payeur,
    reference: row.reference || parsed?.reference,
    paidAt: row.paye_le,
    merchantName: destination?.beneficiaire,
    merchantReference: destination?.reference_destination,
  }, { provenance: "manual_submission" });

  const extracted = {
    direction: parsed?.direction ?? null,
    amount: parsed?.amount ?? null,
    reference: parsed?.reference ?? null,
    payerNumber: parsed?.payerNumber ?? null,
    merchantNumber: parsed?.merchantNumber ?? null,
    occurredAt: parsed?.occurredAt ?? null,
    parser: parsed?.parser ?? "none",
    quality: parsed?.quality ?? "unrecognized",
  };

  const details = {
    ...(row.verification_details && typeof row.verification_details === "object"
      ? row.verification_details as Record<string, unknown>
      : {}),
    ocr: {
      status: "completed",
      confidence: Math.round(confidence),
      processedAt: new Date().toISOString(),
      characterCount: ocrText.length,
      rawTextStored: false,
      mode: "local_browser_ocr",
    },
    ocrExtraction: extracted,
    ocrReasons: validation.reasons,
  };

  const { error: updateError } = await db.from("abonnement_promoteur_reglements")
    .update({
      verification_level: Math.max(Number(row.verification_level ?? 0), 3),
      verification_status: "manual_review",
      verification_details: details,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reglementId).eq("statut", "en_attente");
  if (updateError) return { ok: false, message: "L'analyse a ete effectuee, mais son resultat n'a pas pu etre enregistre." };

  if (parsed?.reference && parsed.reference !== row.reference) {
    const { error: referenceError } = await db.rpc("naxa_promoteur_payment_add_reference", {
      p_reglement: reglementId,
      p_canal: row.canal,
      p_reference: parsed.reference,
      p_source_level: 3,
      p_source_type: "promoter_submission",
      p_provider_occurred_at: parsed.occurredAt,
      p_sms_received_at: new Date().toISOString(),
      p_payload_sha256: null,
    });
    if (referenceError) {
      return {
        ok: true,
        message: "OCR enregistre. La reference extraite entre en conflit avec l'historique ; une verification manuelle est necessaire.",
        extracted,
        reasons: [...validation.reasons, "Reference OCR non rattachee : conflit de reference ou date hors fenetre."],
      };
    }
  }

  await db.from("notifications").insert({
    user_id: user.id,
    type: "abonnement_preuve_ocr_terminee",
    titre: "Analyse OCR du justificatif terminee",
    corps: "Le dossier " + reglementId + " a ete analyse localement. Le texte complet n'a pas ete conserve ; les champs extraits restent en verification manuelle.",
  });

  revalidatePath("/admin/pilotage/reglements");
  revalidatePath("/promoteur/paiements");
  return {
    ok: true,
    message: "OCR termine. Les champs extraits sont enregistres ; la preuve reste a valider manuellement.",
    extracted,
    reasons: validation.reasons,
  };
}

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deviceTokenFromRequest } from "@/lib/appareil-token";
import { isPayerSmsEligibleForAutomaticMatch, parsePromoteurPaymentSms } from "@/lib/promoteurPaymentSms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  reservationId?: string; canal?: "orange_money" | "mtn_momo";
  smsText?: string; payerNumber?: string; amount?: number; paidAt?: string;
  reference?: string; fieldSources?: Record<string, string>;
};

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

export async function POST(request: Request) {
  try {
    const token = deviceTokenFromRequest(request);
    const body = await request.json() as Body;
    const reservationId = String(body.reservationId ?? "");
    const canal = body.canal;
    const smsText = String(body.smsText ?? "").trim().slice(0, 8000);
    if (!token || !/^[0-9a-f-]{36}$/i.test(reservationId) ||
        (canal !== "orange_money" && canal !== "mtn_momo")) {
      return NextResponse.json({ error: "Déclaration de paiement incomplète." }, { status: 400 });
    }
    const db = supabaseAdmin();
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Session Client invalide ou expirée." }, { status: 401 });

    const { data: reservation, error: reservationError } = await db.from("reservations")
      .select("id,client_id,pharmacie_id,total,frais_livraison,mode,paiement_mode,paiement_statut,commande_statut,livraison_confirmee_stock_at")
      .eq("id", reservationId).eq("client_id", auth.user.id).maybeSingle();
    if (reservationError || !reservation || reservation.mode !== "commande" ||
        !reservation.livraison_confirmee_stock_at ||
        !["acceptee", "preparation", "livreur_assigne", "en_livraison"].includes(reservation.commande_statut ?? "") ||
        reservation.paiement_statut === "effectue" ||
        (reservation.paiement_mode === "mtn_marchand" ? canal !== "mtn_momo" : reservation.paiement_mode !== canal)) {
      return NextResponse.json({ error: "Cette commande ne peut pas recevoir cette déclaration de paiement." }, { status: 409 });
    }

    const parsed = smsText ? parsePromoteurPaymentSms(smsText, canal) : null;
    // Parsed values can prefill a declaration, but only a complete, uncorrected
    // payer-debit SMS is eligible for automatic two-SMS matching.
    const extractedPayer = parsed?.direction === "payer_debit" && parsed.success === true
      ? parsed
      : null;
    const amountWasCorrected = body.fieldSources?.amount === "manual_entry";
    const referenceWasCorrected = body.fieldSources?.reference === "manual_entry";
    const dateWasCorrected = body.fieldSources?.paidAt === "manual_entry";
    const expectedAmount = Number(reservation.total) + Number(reservation.frais_livraison);
    const amount = amountWasCorrected
      ? Number(body.amount)
      : extractedPayer?.amount ?? Number(body.amount ?? expectedAmount);
    if (!Number.isSafeInteger(amount) || amount <= 0) return NextResponse.json({ error: "Montant déclaré invalide." }, { status: 400 });
    const reference = String(referenceWasCorrected
      ? body.reference ?? ""
      : extractedPayer?.reference ?? body.reference ?? "").trim();
    if (reference.length < 5 || reference.length > 120 || !/^[\\p{L}\\p{N}\\s_./-]+$/u.test(reference)) {
      return NextResponse.json({ error: "ID / Référence de transaction obligatoire (5 caractères minimum). Le SMS partagé n'a pas permis de l'extraire automatiquement." }, { status: 400 });
    }
    const payerNumber = String(body.fieldSources?.payerNumber === "manual_entry"
      ? body.payerNumber ?? ""
      : extractedPayer?.payerNumber ?? body.payerNumber ?? "").trim().slice(0, 40);
    if (payerNumber && (digits(payerNumber).length < 8 || digits(payerNumber).length > 15)) {
      return NextResponse.json({ error: "Numéro payeur invalide." }, { status: 400 });
    }
    const paidAtRaw = dateWasCorrected
      ? String(body.paidAt ?? "")
      : extractedPayer?.occurredAt ?? String(body.paidAt ?? new Date().toISOString());
    const paidAt = new Date(paidAtRaw);
    const now = new Date();
    if (!Number.isFinite(paidAt.getTime()) || paidAt.getTime() > now.getTime() + 5 * 60_000 ||
        paidAt.getTime() < now.getTime() - 7 * 24 * 60 * 60_000) {
      return NextResponse.json({ error: "Date de paiement invalide ou trop ancienne." }, { status: 400 });
    }
    const parsedProof = isPayerSmsEligibleForAutomaticMatch(extractedPayer,{
      amountManuallyEdited:amountWasCorrected,
      referenceManuallyEdited:referenceWasCorrected,
      dateManuallyEdited:dateWasCorrected,
    });
    const smsHash = smsText ? createHash("sha256").update(smsText).digest("hex") : null;
    const fieldSources = {
      amount: extractedPayer?.amount !== null && extractedPayer?.amount !== undefined && !amountWasCorrected
        ? "sms_extracted"
        : amountWasCorrected ? "manual_entry"
          : body.fieldSources?.amount === "manual_entry" ? "manual_entry" : "generated_default",
      paidAt: extractedPayer?.occurredAt && !dateWasCorrected
        ? "sms_extracted"
        : dateWasCorrected ? "manual_entry"
          : body.fieldSources?.paidAt === "manual_entry" ? "manual_entry"
            : body.fieldSources?.paidAt === "generated_default" ? "generated_default" : "client_declared",
      reference: extractedPayer?.reference && !referenceWasCorrected ? "sms_extracted" : "manual_entry",
      payerNumber: extractedPayer?.payerNumber && body.fieldSources?.payerNumber !== "manual_entry"
        ? "sms_extracted" : payerNumber ? "manual_entry" : "not_provided",
      sms: !smsText ? "not_shared" : parsedProof ? "recognized_complete_payer_debit"
        : extractedPayer ? "shared_incomplete_or_corrected_manual_review" : "shared_unrecognized_manual_review",
    };

    const { data: saved, error: saveError } = await db.rpc("naxa_client_declarer_paiement_livraison_v2", {
      p_reservation: reservation.id,
      p_client: auth.user.id,
      p_reference: reference,
      p_payer_number: payerNumber || null,
      p_declared_amount: amount,
      p_payment_occurred_at: paidAt.toISOString(),
      p_proof_source: parsedProof ? "shared_sms" : "manual_entry",
      p_field_sources: fieldSources,
      p_sms_payload_sha256: smsHash,
    });
    if (saveError || saved !== true) return NextResponse.json({ error: saveError?.message ?? "Déclaration non enregistrée." }, { status: 409 });
    const { data: confirmation } = await db.from("naxa_delivery_payment_confirmations")
      .select("receipt_number,amount_fcfa,confirmed_at")
      .eq("reservation_id", reservation.id)
      .eq("client_id", auth.user.id)
      .maybeSingle();

    if (confirmation) {
      return NextResponse.json({
        received: true,
        status: "financially_confirmed_waiting_pos",
        receiptNumber: confirmation.receipt_number,
        amount: confirmation.amount_fcfa,
        confirmedAt: confirmation.confirmed_at,
        message: "Les SMS de débit et de crédit ont été rapprochés. Paiement confirmé par NAXA. Reçu " +
          confirmation.receipt_number + ". La pharmacie doit encore inscrire le ticket dans sa Caisse.",
      }, { status: 202 });
    }

    const { data: paymentRecord } = await db.from("naxa_delivery_payment_records")
      .select("sms_match_status")
      .eq("reservation_id", reservation.id)
      .eq("client_id", auth.user.id)
      .maybeSingle();

    const matchStatus = paymentRecord?.sms_match_status ?? "not_checked";
    const waitingMessage = matchStatus === "awaiting_merchant_sms"
      ? "Votre déclaration est enregistrée. NAXA attend le SMS de crédit marchand ; l'absence de ce message dans NAXA ne signifie pas que l'opérateur a échoué."
      : matchStatus === "manual_review"
        ? "Votre déclaration et le SMS reçu nécessitent une revue manuelle. Aucun échec opérateur n'est présumé."
        : "Votre déclaration est enregistrée. NAXA rapproche automatiquement les deux SMS dès qu'ils sont disponibles.";

    return NextResponse.json({
      received: true,
      status: matchStatus,
      message: waitingMessage,
    }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Service de déclaration de paiement indisponible." }, { status: 503 });
  }
}

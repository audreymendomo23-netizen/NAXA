import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deviceTokenFromRequest, hashDeviceToken } from "@/lib/appareil-token";
import { parsePromoteurPaymentSms } from "@/lib/promoteurPaymentSms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  deviceId?: string; deviceToken?: string; canal?: "orange_money" | "mtn_momo";
  smsText?: string; payerNumber?: string; amount?: number; paidAt?: string; reference?: string;
};

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const phoneTail = (value: unknown) => digits(value).slice(-9);

export async function POST(request: Request) {
  try {
    const accessToken = deviceTokenFromRequest(request);
    const body = await request.json() as Body;
    const deviceId = String(body.deviceId ?? "");
    const deviceToken = String(body.deviceToken ?? "");
    const canal = body.canal;
    const smsText = String(body.smsText ?? "").trim().slice(0, 8000);
    if (!accessToken || !deviceId || deviceToken.length < 32 ||
        (canal !== "orange_money" && canal !== "mtn_momo") || smsText.length > 8000) {
      return NextResponse.json({ error: "Déclaration de paiement incomplète." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data: auth, error: authError } = await db.auth.getUser(accessToken);
    if (authError || !auth.user) return NextResponse.json({ error: "Session Promoteur invalide ou expirée." }, { status: 401 });
    const { data: profile, error: profileError } = await db.from("profiles")
      .select("id,role,actif").eq("id", auth.user.id).maybeSingle();
    if (profileError || profile?.role !== "promoteur" || profile.actif !== true) {
      return NextResponse.json({ error: "Un compte Promoteur actif est requis." }, { status: 403 });
    }
    const { data: device, error: deviceError } = await db.from("naxa_promoteur_payment_devices")
      .select("id,promoteur_id,is_active,device_token_hash")
      .eq("id", deviceId).eq("promoteur_id", auth.user.id).maybeSingle();
    if (deviceError || !device || device.is_active !== true ||
        device.device_token_hash !== hashDeviceToken(deviceToken)) {
      return NextResponse.json({ error: "Téléphone Promoteur non enrôlé." }, { status: 403 });
    }

    const now = new Date();
    const { data: intent, error: intentError } = await db.from("naxa_promoteur_payment_intents")
      .select("id,canal,expected_amount,destination_snapshot,expires_at,status")
      .eq("promoteur_id", auth.user.id).eq("device_id", device.id)
      .eq("status", "awaiting_payment").gt("expires_at", now.toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (intentError || !intent || intent.canal !== canal) {
      return NextResponse.json({ error: "Préparez d'abord un paiement actif sur ce téléphone et avec ce canal." }, { status: 409 });
    }

    const parsed = smsText ? parsePromoteurPaymentSms(smsText, canal) : null;
    if (smsText && (!parsed || parsed.direction !== "payer_debit" || parsed.success !== true)) {
      return NextResponse.json({ error: "SMS non reconnu comme confirmation de débit. Complétez les informations manuellement ou partagez le SMS de débit correct." }, { status: 422 });
    }

    const amount = parsed?.amount ?? Number(body.amount ?? intent.expected_amount);
    if (!Number.isSafeInteger(amount) || amount !== intent.expected_amount) {
      return NextResponse.json({ error: "Le montant du SMS ne correspond pas au montant exact de l'abonnement préparé.", expectedAmount: intent.expected_amount, extractedAmount: parsed?.amount ?? null }, { status: 409 });
    }
    const payerNumber = String(parsed?.payerNumber ?? body.payerNumber ?? "").trim();
    if (digits(payerNumber).length < 8 || digits(payerNumber).length > 15) {
      return NextResponse.json({ error: "Renseignez le numéro réellement utilisé pour payer." }, { status: 400 });
    }
    const reference = String(parsed?.reference ?? body.reference ?? "").trim();
    if (reference.length < 5 || reference.length > 160) {
      return NextResponse.json({ error: "La référence de transaction est obligatoire (5 caractères minimum)." }, { status: 400 });
    }
    const paidAt = parsed?.occurredAt ?? String(body.paidAt ?? now.toISOString());
    const paidAtDate = new Date(paidAt);
    if (!Number.isFinite(paidAtDate.getTime()) || paidAtDate.getTime() > now.getTime() + 5 * 60_000 ||
        paidAtDate.getTime() < now.getTime() - 24 * 60 * 60_000) {
      return NextResponse.json({ error: "Date de paiement hors de la fenêtre de vérification." }, { status: 400 });
    }

    const extractedProof = Boolean(parsed && parsed.direction === "payer_debit" && parsed.success &&
      parsed.amount === amount && parsed.reference &&
      String(parsed.reference).toUpperCase() === reference.toUpperCase());
    const smsHash = smsText ? createHash("sha256").update(smsText).digest("hex") : null;
    const details = {
      level: extractedProof ? 1 : 3,
      status: extractedProof ? "coherent_needs_operator_confirmation" : "manual_review",
      source: extractedProof ? "promoter_voluntary_sms_share" : "promoter_manual_entry",
      parser: parsed?.parser ?? "none",
      quality: parsed?.quality ?? "unrecognized",
      direction: parsed?.direction ?? null,
      success: parsed?.success ?? false,
      amount,
      extractedReference: parsed?.reference ?? null,
      extractedPayerNumber: parsed?.payerNumber ?? null,
      extractedMerchantNumber: parsed?.merchantNumber ?? null,
      extractedMerchantLabel: parsed?.merchantLabel ?? null,
      providerOccurredAt: parsed?.occurredAt ?? null,
      smsPayloadSha256: smsHash,
      fieldSources: {
        amount: parsed?.amount !== null && parsed?.amount !== undefined ? "sms_extracted" : "generated_default_or_manual",
        reference: parsed?.reference ? "sms_extracted" : "manual_entry",
        payerNumber: parsed?.payerNumber ? "sms_extracted" : "manual_entry",
        paidAt: parsed?.occurredAt ? "sms_extracted" : "generated_default_or_manual",
      },
      rawSmsStored: false,
      requiresAdminCreditProof: true,
    };

    const { data: reglementId, error: submitError } = await db.rpc("promoteur_soumettre_reglement", {
      p_promoteur: auth.user.id,
      p_montant: amount,
      p_canal: canal,
      p_canal_autre: null,
      p_compte_payeur: payerNumber,
      p_reference: reference,
      p_paye_le: paidAtDate.toISOString(),
      p_preuve_path: null,
      p_verification_details: details,
    });
    if (submitError || !reglementId) {
      const message = (submitError?.message ?? "").toLowerCase();
      const status = message.includes("reference") ? 409 : message.includes("attente") ? 409 : 503;
      return NextResponse.json({ error: submitError?.message ?? "Déclaration non enregistrée." }, { status });
    }

    await db.from("naxa_promoteur_payment_intents").update({
      status: "submission_created", linked_reglement_id: reglementId, updated_at: now.toISOString(),
    }).eq("id", intent.id);

    return NextResponse.json({
      received: true, reglementId,
      status: extractedProof ? "payer_sms_shared_waiting_admin_credit" : "manual_review",
      message: "Déclaration reçue. L'abonnement ne sera activé qu'après rapprochement avec le SMS de crédit Admin ou confirmation manuelle.",
    }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Service de partage SMS Promoteur indisponible." }, { status: 503 });
  }
}

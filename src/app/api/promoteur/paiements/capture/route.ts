import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deviceTokenFromRequest, hashDeviceToken } from "@/lib/appareil-token";
import { parsePromoteurPaymentSms } from "@/lib/promoteurPaymentSms";
import { interpretPromoteurPaymentSms } from "@/lib/promoteurPaymentSmsAI";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CaptureBody = {
  deviceId?: string;
  deviceToken?: string;
  canal?: "mtn_momo" | "orange_money";
  smsText?: string;
  senderOriginAddress?: string;
  smsReceivedAt?: string;
};

const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export async function POST(request: Request) {
  try {
    const accessToken = deviceTokenFromRequest(request);
    const body = await request.json() as CaptureBody;
    const deviceId = String(body.deviceId ?? "");
    const deviceToken = String(body.deviceToken ?? "");
    const canal = body.canal;
    const smsText = String(body.smsText ?? "").slice(0, 8000);
    const senderOriginAddress = String(body.senderOriginAddress ?? "").trim().slice(0, 80);
    const smsReceivedAt = new Date(String(body.smsReceivedAt ?? ""));

    if (!accessToken || !deviceId || deviceToken.length < 32 ||
        !["mtn_momo", "orange_money"].includes(String(canal)) ||
        smsText.length < 12 || !Number.isFinite(smsReceivedAt.getTime()) ||
        !senderOriginAddress) {
      return NextResponse.json({ error: "Capture SMS Android incomplete ou invalide." }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { data: auth, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !auth.user) return NextResponse.json({ error: "Session Promoteur invalide ou expiree." }, { status: 401 });
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("role,actif").eq("id", auth.user.id).maybeSingle();
    if (profileError || profile?.role !== "promoteur" || profile.actif !== true) {
      return NextResponse.json({ error: "Un compte Promoteur actif est requis." }, { status: 403 });
    }
    const { data: device, error: deviceError } = await admin.from("naxa_promoteur_payment_devices")
      .select("id,promoteur_id,is_active,device_token_hash")
      .eq("id", deviceId).eq("promoteur_id", auth.user.id).maybeSingle();
    if (deviceError || !device || device.is_active !== true || device.device_token_hash !== hashDeviceToken(deviceToken)) {
      return NextResponse.json({ error: "Telephone non enrole pour ce compte Promoteur." }, { status: 403 });
    }

    const now = new Date();
    if (smsReceivedAt.getTime() > now.getTime() + 60_000 ||
        smsReceivedAt.getTime() < now.getTime() - 30 * 60_000) {
      return NextResponse.json({ error: "Heure de reception SMS hors de la fenetre de verification." }, { status: 400 });
    }
    const parsed = parsePromoteurPaymentSms(smsText, canal as "mtn_momo" | "orange_money", senderOriginAddress) ??
      await interpretPromoteurPaymentSms(smsText, canal as "mtn_momo" | "orange_money", senderOriginAddress);

    await admin.from("naxa_promoteur_payment_devices")
      .update({ last_seen_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("id", deviceId).eq("promoteur_id", auth.user.id);

    const { data: intent, error: intentError } = await admin.from("naxa_promoteur_payment_intents")
      .select("id,canal,expected_amount,currency,destination_snapshot,expires_at,created_at,status")
      .eq("promoteur_id", auth.user.id).eq("device_id", deviceId)
      .eq("status", "awaiting_payment").gt("expires_at", now.toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (intentError || !intent) return NextResponse.json({ error: "Aucun paiement actif n'est associe a ce telephone." }, { status: 409 });
    if (intent.canal !== canal) return NextResponse.json({ error: "Le canal SMS ne correspond pas au paiement prepare." }, { status: 409 });

    const destination = intent.destination_snapshot as { beneficiaire?: string; reference_destination?: string };
    const officialSender = parsed?.senderTrusted === true &&
      normalize(senderOriginAddress) === normalize(canal === "orange_money" ? "OrangeMoney" : "MobileMoney");
    const timeWithinIntent = smsReceivedAt.getTime() >= new Date(intent.created_at).getTime() - 5 * 60_000 &&
      smsReceivedAt.getTime() <= new Date(intent.expires_at).getTime() + 5 * 60_000;
    const providerTime = parsed?.occurredAt ? new Date(parsed.occurredAt).getTime() : null;
    const providerTimeCoherent = providerTime === null ||
      (providerTime <= now.getTime() + 60_000 &&
       providerTime >= new Date(intent.created_at).getTime() - 5 * 60_000 &&
       providerTime <= new Date(intent.expires_at).getTime() + 5 * 60_000);
    const targetNumber = normalize(destination.reference_destination ?? "");
    const targetName = normalize(destination.beneficiaire ?? "");
    const destinationMatches = Boolean(parsed?.merchantNumber && targetNumber && normalize(parsed.merchantNumber) === targetNumber) ||
      Boolean(parsed?.merchantLabel && targetName && normalize(parsed.merchantLabel) === targetName);
    const amountMatches = parsed?.amount === intent.expected_amount;
    const candidateIsDebit = parsed?.direction === "payer_debit";
    const success = parsed?.success === true;
    const reference = String(parsed?.reference ?? "").trim();
    const isMatched = Boolean(
      parsed && officialSender && timeWithinIntent && providerTimeCoherent &&
      amountMatches && destinationMatches && candidateIsDebit && success &&
      parsed.quality === "complete" && reference.length >= 5
    );

    const payloadHash = createHash("sha256").update(JSON.stringify({
      deviceId, canal, reference, amount: parsed?.amount ?? null,
      senderOriginAddress, smsReceivedAt: smsReceivedAt.toISOString(),
      bodyHash: createHash("sha256").update(smsText).digest("hex"),
    })).digest("hex");

    if (!parsed || !reference || parsed.amount === null) {
      await admin.from("naxa_promoteur_payment_intents").update({ status: "manual_review", updated_at: now.toISOString() }).eq("id", intent.id);
      return NextResponse.json({
        received: true, status: "manual_review",
        message: "SMS non reconnu. Transmettez le justificatif dans votre espace Promoteur ; aucun abonnement n'est renouvelé.",
      }, { status: 202 });
    }

    const { data: event, error: eventError } = await admin.from("naxa_promoteur_payment_capture_events").insert({
      promoteur_id: auth.user.id,
      device_id: deviceId,
      intent_id: intent.id,
      canal,
      transaction_reference: reference,
      amount: parsed.amount ?? 1,
      currency: "FCFA",
      recipient_reference: parsed.merchantNumber ?? parsed.merchantLabel ?? null,
      sender_account_masked: parsed.payerNumber ?? "non_lisible",
      provider_occurred_at: parsed.occurredAt,
      payload_sha256: payloadHash,
      match_status: isMatched ? "matched" : "mismatch",
    }).select("id").single();

    if (eventError) {
      if (eventError.code === "23505") return NextResponse.json({ error: "Cette reference de transaction a deja ete recue." }, { status: 409 });
      return NextResponse.json({ error: "Enregistrement securise de la notification impossible." }, { status: 503 });
    }

    if (!isMatched) {
      await admin.from("naxa_promoteur_payment_intents").update({ status: "manual_review", updated_at: now.toISOString() }).eq("id", intent.id);
      const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin").eq("actif", true);
      if (admins?.length) {
        await admin.from("notifications").insert(admins.map((item: { id: string }) => ({
          user_id: item.id, type: "abonnement_capture_mobile_a_revoir",
          titre: "Notification de paiement a rapprocher",
          corps: "Une notification SMS a ete capturee, mais son identifiant expéditeur, son montant, son beneficiaire, son horodatage ou son type ne correspond pas exactement au paiement prepare. Aucun renouvellement automatique n'a ete effectue.",
        })));
      }
      return NextResponse.json({ received: true, eventId: event.id, status: "manual_review" }, { status: 202 });
    }

    const paidAt = parsed.occurredAt ?? smsReceivedAt.toISOString();
    const details = {
      level: 1,
      status: "coherent_needs_operator_confirmation",
      parser: parsed.parser,
      quality: parsed.quality,
      direction: parsed.direction,
      success: true,
      amount: parsed.amount,
      extractedReference: parsed.reference,
      extractedPayerNumber: parsed.payerNumber,
      extractedMerchantNumber: parsed.merchantNumber,
      extractedMerchantLabel: parsed.merchantLabel,
      providerOccurredAt: parsed.occurredAt,
      smsReceivedAt: smsReceivedAt.toISOString(),
      smsSenderId: senderOriginAddress,
      senderIdMatchesExpected: true,
      dateTimeCoherent: true,
      destinationMatches: true,
      uniqueReference: true,
      rawSmsStored: false,
    };

    const { data: reglementId, error: submitError } = await admin.rpc("promoteur_soumettre_reglement", {
      p_promoteur: auth.user.id,
      p_montant: parsed.amount,
      p_canal: canal,
      p_canal_autre: null,
      p_compte_payeur: parsed.payerNumber ?? "non_lisible",
      p_reference: reference,
      p_paye_le: paidAt,
      p_preuve_path: null,
      p_verification_details: details,
    });
    if (submitError || !reglementId) {
      await admin.from("naxa_promoteur_payment_intents").update({ status: "manual_review", updated_at: now.toISOString() }).eq("id", intent.id);
      await admin.from("naxa_promoteur_payment_capture_events").update({ match_status: "mismatch" }).eq("id", event.id);
      return NextResponse.json({ received: true, status: "manual_review", message: "Notification conservee pour verification manuelle." }, { status: 202 });
    }
    await admin.from("naxa_promoteur_payment_intents").update({
      status: "submission_created", linked_reglement_id: reglementId, updated_at: now.toISOString(),
    }).eq("id", intent.id);
    await admin.from("naxa_promoteur_payment_capture_events").update({ match_status: "submitted" }).eq("id", event.id);
    return NextResponse.json({
      received: true, status: "pending_admin_confirmation",
      message: "SMS rapproche avec le montant, le beneficiaire et la reference. Le renouvellement attend encore une confirmation independante.",
    }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Service de capture Android indisponible." }, { status: 503 });
  }
}

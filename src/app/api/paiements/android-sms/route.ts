import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deviceTokenFromRequest, hashDeviceToken } from "@/lib/appareil-token";
import { parsePromoteurPaymentSms } from "@/lib/promoteurPaymentSms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SENDER_CHANNELS: Record<string, "orange_money" | "mtn_momo"> = {
  OrangeMoney: "orange_money",
  MobileMoney: "mtn_momo",
};
const tail = (value: string | null | undefined) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-9) : null;
};

/**
 * Stores an incoming recipient-side SMS as structured evidence.
 * The sender label only selects the SMS stream; it is not payment proof.
 * No raw SMS body is persisted and a single event never marks money as paid.
 */
export async function POST(request: Request) {
  try {
    const accessToken = deviceTokenFromRequest(request);
    if (!accessToken) return NextResponse.json({ error: "Session NAXA requise." }, { status: 401 });
    const body = await request.json() as {
      deviceId?: string; deviceToken?: string; canal?: string; smsText?: string;
      senderOriginAddress?: string; smsReceivedAt?: string;
    };
    const deviceId = String(body.deviceId ?? "");
    const deviceToken = String(body.deviceToken ?? "");
    const channel = body.canal;
    const smsText = String(body.smsText ?? "").trim().slice(0, 8000);
    const sender = String(body.senderOriginAddress ?? "").trim();
    const smsReceivedAt = new Date(String(body.smsReceivedAt ?? ""));
    if (!deviceId || deviceToken.length < 32 ||
        (channel !== "orange_money" && channel !== "mtn_momo") ||
        SENDER_CHANNELS[sender] !== channel ||
        smsText.length < 12 || !Number.isFinite(smsReceivedAt.getTime())) {
      return NextResponse.json({ error: "SMS reçu incomplet ou source hors liste." }, { status: 400 });
    }

    const now = new Date();
    if (smsReceivedAt.getTime() > now.getTime() + 60_000 ||
        smsReceivedAt.getTime() < now.getTime() - 7 * 24 * 60 * 60_000) {
      return NextResponse.json({ error: "SMS reçu hors de la fenêtre de collecte (7 jours)." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data: auth, error: authError } = await db.auth.getUser(accessToken);
    if (authError || !auth.user) return NextResponse.json({ error: "Session NAXA invalide." }, { status: 401 });

    const { data: device, error: deviceError } = await db.from("naxa_payment_notification_devices")
      .select("id,user_id,workspace_type,workspace_id,device_token_hash,is_active,sms_consent_at")
      .eq("id", deviceId).eq("user_id", auth.user.id).maybeSingle();
    if (deviceError || !device || !device.is_active || !device.sms_consent_at ||
        !["pharmacie", "partner"].includes(device.workspace_type) ||
        device.device_token_hash !== hashDeviceToken(deviceToken)) {
      return NextResponse.json({ error: "Téléphone professionnel non enrôlé ou consentement SMS manquant." }, { status: 403 });
    }

    const { data: profile } = await db.from("profiles").select("role,actif,pharmacie_id")
      .eq("id", auth.user.id).maybeSingle();
    if (profile?.actif !== true) return NextResponse.json({ error: "Compte NAXA inactif." }, { status: 403 });

    let scopeValid = false;
    if (device.workspace_type === "pharmacie") {
      scopeValid = profile.role === "pharmacie" && profile.pharmacie_id === device.workspace_id;
    } else if (device.workspace_type === "partner") {
      const { data: membership } = await db.from("partner_members")
        .select("partner_id").eq("partner_id", device.workspace_id)
        .eq("user_id", auth.user.id).in("member_role", ["owner", "manager"]).maybeSingle();
      const { data: partner } = await db.from("partners").select("id,status")
        .eq("id", device.workspace_id).maybeSingle();
      scopeValid = Boolean(membership && partner?.status === "active");
    }
    if (!scopeValid) return NextResponse.json({ error: "Périmètre professionnel non autorisé." }, { status: 403 });

    const parsed = parsePromoteurPaymentSms(smsText, channel, sender);
    const payloadHash = createHash("sha256").update(JSON.stringify({
      deviceId, channel, sender, smsReceivedAt: smsReceivedAt.toISOString(), smsText,
    })).digest("hex");

    const { data: event, error: insertError } = await db.from("naxa_payment_evidence_intake").insert({
      device_id: device.id,
      actor_id: auth.user.id,
      workspace_type: device.workspace_type,
      workspace_id: device.workspace_id,
      canal: channel,
      source_type: "sms_receiver",
      source_package: null,
      source_sender: sender,
      direction: parsed?.direction ?? "unknown",
      success: parsed?.success === true,
      amount: parsed?.amount ?? null,
      transaction_reference: parsed?.reference ?? null,
      payer_number_tail: tail(parsed?.payerNumber),
      merchant_number_tail: tail(parsed?.merchantNumber),
      merchant_label: parsed?.merchantLabel?.slice(0, 160) ?? null,
      provider_occurred_at: parsed?.occurredAt ?? null,
      source_payload_sha256: payloadHash,
      match_status: "manual_review",
      received_at: now.toISOString(),
    }).select("id,direction,amount,transaction_reference,match_status").single();
    if (insertError?.code === "23505") return NextResponse.json({ received: true, status: "duplicate" }, { status: 200 });
    if (insertError || !event) return NextResponse.json({ error: "Conservation du SMS reçu impossible." }, { status: 503 });

    await db.from("naxa_payment_notification_devices").update({
      last_seen_at: now.toISOString(), updated_at: now.toISOString(),
    }).eq("id", device.id);
    return NextResponse.json({
      received: true, eventId: event.id, direction: event.direction,
      amount: event.amount, reference: event.transaction_reference,
      status: "waiting_for_pair",
      message: "SMS bénéficiaire reçu et enregistré. Il reste à rapprocher du SMS de débit du payeur ; aucun paiement n'est confirmé par ce seul SMS.",
    }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Collecte du SMS bénéficiaire indisponible." }, { status: 503 });
  }
}

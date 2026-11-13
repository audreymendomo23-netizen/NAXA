import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deviceTokenFromRequest, hashDeviceToken } from "@/lib/appareil-token";
import { parsePromoteurPaymentSms } from "@/lib/promoteurPaymentSms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tail = (value: string | null | undefined) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-9) : null;
};

export async function POST(request: Request) {
  try {
    const accessToken = deviceTokenFromRequest(request);
    const body = await request.json() as { deviceId?: string; deviceToken?: string; canal?: string; smsText?: string };
    const deviceId = String(body.deviceId ?? "");
    const token = String(body.deviceToken ?? "");
    const channel = body.canal;
    const smsText = String(body.smsText ?? "").trim().slice(0, 8000);
    if (!accessToken || !deviceId || token.length < 32 ||
        (channel !== "orange_money" && channel !== "mtn_momo") || smsText.length < 12) {
      return NextResponse.json({ error: "SMS partagé incomplet." }, { status: 400 });
    }
    const db = supabaseAdmin();
    const { data: auth, error: authError } = await db.auth.getUser(accessToken);
    if (authError || !auth.user) return NextResponse.json({ error: "Session NAXA invalide." }, { status: 401 });
    const { data: device, error } = await db.from("naxa_payment_notification_devices")
      .select("id,user_id,workspace_type,workspace_id,device_token_hash,is_active")
      .eq("id", deviceId).eq("user_id", auth.user.id).maybeSingle();
    if (error || !device || !device.is_active || device.workspace_type !== "pharmacie" ||
        device.device_token_hash !== hashDeviceToken(token)) {
      return NextResponse.json({ error: "Téléphone Pharmacie non enrôlé." }, { status: 403 });
    }
    const { data: profile } = await db.from("profiles").select("role,actif,pharmacie_id")
      .eq("id", auth.user.id).maybeSingle();
    if (profile?.role !== "pharmacie" || profile.actif !== true || profile.pharmacie_id !== device.workspace_id) {
      return NextResponse.json({ error: "Périmètre Pharmacie invalide." }, { status: 403 });
    }
    const parsed = parsePromoteurPaymentSms(smsText, channel);
    const hash = createHash("sha256").update([channel, smsText].join("|")).digest("hex");
    const { data: event, error: insertError } = await db.from("naxa_payment_evidence_intake").insert({
      device_id: device.id, actor_id: auth.user.id, workspace_type: "pharmacie",
      workspace_id: device.workspace_id, canal: channel, source_type: "voluntary_sms_share",
      source_package: null, direction: parsed?.direction ?? "unknown", success: parsed?.success === true,
      amount: parsed?.amount ?? null, transaction_reference: parsed?.reference ?? null,
      payer_number_tail: tail(parsed?.payerNumber), merchant_number_tail: tail(parsed?.merchantNumber),
      merchant_label: parsed?.merchantLabel?.slice(0, 160) ?? null,
      provider_occurred_at: parsed?.occurredAt ?? null, source_payload_sha256: hash,
      match_status: "manual_review",
    }).select("id").single();
    if (insertError?.code === "23505") return NextResponse.json({ received: true, status: "duplicate" }, { status: 200 });
    if (insertError || !event) return NextResponse.json({ error: "Conservation du SMS partagé impossible." }, { status: 503 });
    return NextResponse.json({
      received: true, eventId: event.id, status: "manual_review",
      message: "SMS transmis comme élément de rapprochement. L'origine n'est pas authentifiée par le partage Android et aucun abonnement n'est confirmé.",
    }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Réception du SMS partagé indisponible." }, { status: 503 });
  }
}

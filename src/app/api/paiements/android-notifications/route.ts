import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deviceTokenFromRequest, hashDeviceToken } from "@/lib/appareil-token";
import { parsePromoteurPaymentSms } from "@/lib/promoteurPaymentSms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PACKAGE_CHANNELS: Record<string, "orange_money" | "mtn_momo"> = {
  "mtnft.momo.consumer": "mtn_momo",
  "com.orange.myorange.ocm": "orange_money",
  "com.orange.money.cm.pro": "orange_money",
  "com.orange.orangemoneyafrique": "orange_money",
};
const tail = (value: string | null | undefined) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-9) : null;
};

export async function POST(request: Request) {
  try {
    const accessToken = deviceTokenFromRequest(request);
    const body = await request.json() as {
      deviceId?: string; deviceToken?: string; canal?: string; sourcePackage?: string;
      notificationText?: string; postedAt?: string;
    };
    const deviceId = String(body.deviceId ?? "");
    const token = String(body.deviceToken ?? "");
    const channel = body.canal;
    const sourcePackage = String(body.sourcePackage ?? "");
    const text = String(body.notificationText ?? "").trim().slice(0, 8000);
    const postedAt = new Date(String(body.postedAt ?? ""));
    if (!accessToken || !deviceId || token.length < 32 ||
        (channel !== "orange_money" && channel !== "mtn_momo") ||
        PACKAGE_CHANNELS[sourcePackage] !== channel || text.length < 12 ||
        !Number.isFinite(postedAt.getTime())) {
      return NextResponse.json({ error: "Notification de paiement incomplète ou source inconnue." }, { status: 400 });
    }
    const now = new Date();
    if (postedAt.getTime() > now.getTime() + 5 * 60_000 || postedAt.getTime() < now.getTime() - 24 * 60 * 60_000) {
      return NextResponse.json({ error: "Notification hors fenêtre de vérification." }, { status: 400 });
    }
    const db = supabaseAdmin();
    const { data: auth, error: authError } = await db.auth.getUser(accessToken);
    if (authError || !auth.user) return NextResponse.json({ error: "Session NAXA invalide." }, { status: 401 });
    const { data: device, error } = await db.from("naxa_payment_notification_devices")
      .select("id,user_id,workspace_type,workspace_id,device_token_hash,is_active,notification_consent_at")
      .eq("id", deviceId).eq("user_id", auth.user.id).maybeSingle();
    if (error || !device || !device.is_active || !device.notification_consent_at ||
        device.device_token_hash !== hashDeviceToken(token)) {
      return NextResponse.json({ error: "Appareil non enrôlé ou consentement manquant." }, { status: 403 });
    }
    const { data: profile } = await db.from("profiles").select("role,actif,pharmacie_id")
      .eq("id", auth.user.id).maybeSingle();
    if (profile?.actif !== true) return NextResponse.json({ error: "Compte NAXA inactif." }, { status: 403 });
    let scopeValid = false;
    if (device.workspace_type === "admin") scopeValid = profile.role === "admin" && device.workspace_id === auth.user.id;
    else if (device.workspace_type === "pharmacie") scopeValid = profile.role === "pharmacie" && profile.pharmacie_id === device.workspace_id;
    else if (device.workspace_type === "partner") {
      const { data: membership } = await db.from("partner_members")
        .select("partner_id,partners!inner(status)").eq("partner_id", device.workspace_id)
        .eq("user_id", auth.user.id).in("member_role", ["owner", "manager"]).maybeSingle();
      scopeValid = Boolean(membership && membership.partners?.status === "active");
    }
    if (!scopeValid) return NextResponse.json({ error: "Espace non autorisé à lire les notifications." }, { status: 403 });
    const parsed = parsePromoteurPaymentSms(text, channel);
    const hash = createHash("sha256").update([sourcePackage, channel, postedAt.toISOString(), text].join("|")).digest("hex");
    const { data: event, error: insertError } = await db.from("naxa_payment_evidence_intake").insert({
      device_id: device.id, actor_id: auth.user.id, workspace_type: device.workspace_type,
      workspace_id: device.workspace_id, canal: channel, source_type: "notification",
      source_package: sourcePackage, direction: parsed?.direction ?? "unknown",
      success: parsed?.success === true, amount: parsed?.amount ?? null,
      transaction_reference: parsed?.reference ?? null,
      payer_number_tail: tail(parsed?.payerNumber), merchant_number_tail: tail(parsed?.merchantNumber),
      merchant_label: parsed?.merchantLabel?.slice(0, 160) ?? null,
      provider_occurred_at: parsed?.occurredAt ?? null, source_payload_sha256: hash,
      match_status: "manual_review", received_at: now.toISOString(),
    }).select("id,direction,amount,transaction_reference,match_status").single();
    if (insertError?.code === "23505") return NextResponse.json({ received: true, status: "duplicate" }, { status: 200 });
    if (insertError || !event) return NextResponse.json({ error: "Conservation de la preuve impossible." }, { status: 503 });
    await db.from("naxa_payment_notification_devices").update({
      last_seen_at: now.toISOString(), updated_at: now.toISOString(),
    }).eq("id", device.id);
    return NextResponse.json({
      received: true, eventId: event.id, direction: event.direction, amount: event.amount,
      reference: event.transaction_reference, status: "manual_review",
      message: "Notification conservée comme élément de rapprochement. Elle ne confirme pas seule le paiement.",
    }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Collecte de notification indisponible." }, { status: 503 });
  }
}

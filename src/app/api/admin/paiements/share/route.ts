import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deviceTokenFromRequest, hashDeviceToken } from "@/lib/appareil-token";
import { parsePromoteurPaymentSms } from "@/lib/promoteurPaymentSms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  deviceId?: string; deviceToken?: string; canal?: "orange_money" | "mtn_momo";
  smsText?: string; sourceType?: "voluntary_sms_share" | "notification_listener_candidate";
  senderTitle?: string;
};

export async function POST(request: Request) {
  try {
    const accessToken = deviceTokenFromRequest(request);
    const body = await request.json() as Body;
    const canal = body.canal;
    const smsText = String(body.smsText ?? "").trim().slice(0, 8000);
    const sourceType = body.sourceType ?? "voluntary_sms_share";
    const senderTitle = String(body.senderTitle ?? "").trim();
    if (!accessToken || !body.deviceId || String(body.deviceToken ?? "").length < 32 ||
        (canal !== "orange_money" && canal !== "mtn_momo") || smsText.length < 12 ||
        !["voluntary_sms_share", "notification_listener_candidate"].includes(sourceType) ||
        (sourceType === "notification_listener_candidate" &&
          senderTitle !== (canal === "orange_money" ? "OrangeMoney" : "MobileMoney"))) {
      return NextResponse.json({ error: "SMS Admin partagé incomplet." }, { status: 400 });
    }
    const db = supabaseAdmin();
    const { data: auth, error: authError } = await db.auth.getUser(accessToken);
    if (authError || !auth.user) return NextResponse.json({ error: "Session Admin invalide ou expirée." }, { status: 401 });
    const { data: profile } = await db.from("profiles").select("role,actif").eq("id", auth.user.id).maybeSingle();
    if (profile?.role !== "admin" || profile.actif !== true) return NextResponse.json({ error: "Compte Administrateur actif requis." }, { status: 403 });
    const { data: device } = await db.from("naxa_admin_payment_devices")
      .select("id,admin_id,canal,merchant_reference,device_token_hash,is_active")
      .eq("id", body.deviceId).eq("admin_id", auth.user.id).maybeSingle();
    if (!device || device.is_active !== true || device.canal !== canal ||
        device.device_token_hash !== hashDeviceToken(String(body.deviceToken))) {
      return NextResponse.json({ error: "Téléphone Admin non enrôlé pour ce canal." }, { status: 403 });
    }
    const { data: destination } = await db.from("naxa_payment_destinations")
      .select("reference_destination").eq("canal", canal).eq("actif", true).maybeSingle();
    if (!destination || destination.reference_destination !== device.merchant_reference) {
      return NextResponse.json({ error: "Destination NAXA modifiée ; réenrôlez le téléphone Admin." }, { status: 409 });
    }
    const parsed = parsePromoteurPaymentSms(smsText, canal);
    if (!parsed || parsed.direction !== "merchant_credit" || parsed.success !== true ||
        !parsed.amount || !parsed.reference || parsed.reference.length < 5) {
      return NextResponse.json({ error: "SMS de crédit incomplet ou non reconnu. Utilisez la vérification manuelle Admin." }, { status: 422 });
    }
    const hash = createHash("sha256").update(smsText).digest("hex");
    const { data: possibleReglements } = await db.from("abonnement_promoteur_reglements")
      .select("id,compte_payeur,montant,canal,reference")
      .eq("canal", canal).eq("montant", parsed.amount)
      .eq("reference", parsed.reference).eq("statut", "en_attente").limit(3);
    const exactMatches = (possibleReglements ?? []).filter((row: any) =>
      String(row.reference ?? "").toUpperCase() === String(parsed.reference).toUpperCase() &&
      String(row.compte_payeur ?? "").replace(/\\D/g, "").slice(-9) === String(parsed.payerNumber ?? "").replace(/\\D/g, "").slice(-9)
    );
    const linkedReglementId = exactMatches.length === 1 ? exactMatches[0].id : null;
    const { data: event, error } = await db.from("naxa_admin_payment_capture_events").insert({
      admin_id: auth.user.id,
      device_id: device.id,
      reglement_id: linkedReglementId,
      canal,
      direction: "merchant_credit",
      success: true,
      transaction_reference: parsed.reference,
      amount: parsed.amount,
      currency: "FCFA",
      payer_number: parsed.payerNumber,
      merchant_reference: device.merchant_reference,
      sender_origin_id: sourceType === "notification_listener_candidate"
        ? "NOTIFICATION_LISTENER_CANDIDATE:" + senderTitle
        : "MANUAL_SHARE",
      provider_occurred_at: parsed.occurredAt,
      sms_received_at: new Date().toISOString(),
      payload_sha256: hash,
      match_status: "manual_review",
    }).select("id").single();
    if (error?.code === "23505") return NextResponse.json({ received: true, status: "duplicate" }, { status: 409 });
    if (error || !event) return NextResponse.json({ error: "Conservation du SMS partagé impossible." }, { status: 503 });
    const { data: admins } = await db.from("profiles").select("id").eq("role", "admin").eq("actif", true);
    if (admins?.length) await db.from("notifications").insert(admins.map((item: {id:string}) => ({
      user_id: item.id, type: "abonnement_capture_admin_a_revoir",
      titre: "SMS de crédit partagé · vérification requise",
      corps: sourceType === "notification_listener_candidate"
        ? "Une notification de paiement a été détectée sur le téléphone Admin. Son titre n'authentifie pas l'expéditeur SMS ; vérification manuelle obligatoire."
        : "Un SMS de crédit a été partagé volontairement depuis le compagnon Admin. Il n'est pas considéré comme une capture système et ne déclenche aucune confirmation automatique.",
    })));
    return NextResponse.json({ received: true, eventId: event.id, status: "manual_review" }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Service de partage SMS Admin indisponible." }, { status: 503 });
  }
}

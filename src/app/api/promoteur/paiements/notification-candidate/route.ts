import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deviceTokenFromRequest, hashDeviceToken } from "@/lib/appareil-token";
import { parsePromoteurPaymentSms } from "@/lib/promoteurPaymentSms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  deviceId?: string; deviceToken?: string; canal?: "orange_money" | "mtn_momo";
  senderTitle?: string; notificationText?: string; sourcePackage?: string; receivedAt?: string;
};

export async function POST(request: Request) {
  try {
    const accessToken = deviceTokenFromRequest(request);
    const body = await request.json() as Body;
    const canal = body.canal;
    const expectedTitle = canal === "orange_money" ? "OrangeMoney" : "MobileMoney";
    const senderTitle = String(body.senderTitle ?? "");
    const notificationText = String(body.notificationText ?? "").trim().slice(0, 8000);
    const sourcePackage = String(body.sourcePackage ?? "").trim().slice(0, 180);
    const receivedAt = new Date(String(body.receivedAt ?? ""));
    if (!accessToken || !body.deviceId || String(body.deviceToken ?? "").length < 32 ||
        (canal !== "orange_money" && canal !== "mtn_momo") || senderTitle !== expectedTitle ||
        notificationText.length < 12 || !sourcePackage ||
        !Number.isFinite(receivedAt.getTime()) || receivedAt.getTime() > Date.now() + 60_000 ||
        receivedAt.getTime() < Date.now() - 24 * 60 * 60_000) {
      return NextResponse.json({ error: "Notification de paiement Promoteur incomplète ou hors délai." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data: auth, error: authError } = await db.auth.getUser(accessToken);
    if (authError || !auth.user) return NextResponse.json({ error: "Session Promoteur invalide ou expirée." }, { status: 401 });
    const { data: profile } = await db.from("profiles").select("id,role,actif").eq("id", auth.user.id).maybeSingle();
    if (profile?.role !== "promoteur" || profile.actif !== true) {
      return NextResponse.json({ error: "Un compte Promoteur actif est requis." }, { status: 403 });
    }
    const { data: device } = await db.from("naxa_promoteur_payment_devices")
      .select("id,promoteur_id,is_active,device_token_hash")
      .eq("id", body.deviceId).eq("promoteur_id", auth.user.id).maybeSingle();
    if (!device || !device.is_active || device.device_token_hash !== hashDeviceToken(String(body.deviceToken))) {
      return NextResponse.json({ error: "Téléphone Promoteur non enrôlé." }, { status: 403 });
    }
    const { data: intent, error: intentError } = await db.from("naxa_promoteur_payment_intents")
      .select("id,canal,expected_amount,expires_at,status")
      .eq("promoteur_id", auth.user.id).eq("device_id", device.id)
      .eq("status", "awaiting_payment").gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (intentError || !intent || intent.canal !== canal) {
      return NextResponse.json({ error: "Aucune intention d'abonnement active ne correspond à cette notification." }, { status: 409 });
    }

    const parsed = parsePromoteurPaymentSms(notificationText, canal);
    if (!parsed || parsed.direction !== "payer_debit" || parsed.success !== true ||
        parsed.amount !== intent.expected_amount || !parsed.reference || parsed.reference.length < 5 ||
        !parsed.payerNumber) {
      return NextResponse.json({ error: "Notification non rapprochable avec certitude du montant et du débit attendus." }, { status: 422 });
    }

    const payloadHash = createHash("sha256").update(notificationText).digest("hex");
    const { data: candidate, error } = await db.from("naxa_promoteur_payment_notification_candidates").insert({
      promoteur_id: auth.user.id, device_id: device.id, intent_id: intent.id, canal,
      sender_title: senderTitle, source_package: sourcePackage, amount: parsed.amount,
      transaction_reference: parsed.reference, payer_number: parsed.payerNumber,
      merchant_number: parsed.merchantNumber, provider_occurred_at: parsed.occurredAt,
      received_at: receivedAt.toISOString(), payload_sha256: payloadHash, status: "manual_review",
    }).select("id").single();
    if (error?.code === "23505") return NextResponse.json({ received: true, status: "duplicate" }, { status: 409 });
    if (error || !candidate) return NextResponse.json({ error: "Conservation de l'indice de paiement impossible." }, { status: 503 });

    const { data: admins } = await db.from("profiles").select("id").eq("role", "admin").eq("actif", true);
    if (admins?.length) await db.from("notifications").insert(admins.map((admin: { id: string }) => ({
      user_id: admin.id, type: "abonnement_capture_admin_a_revoir",
      titre: "Notification Promoteur à rapprocher",
      corps: "Une notification de débit correspond au montant de l'intention Promoteur. Le titre de notification n'authentifie pas le SMS ; le dossier reste en revue manuelle et l'intention de paiement demeure ouverte.",
    })));
    await db.from("naxa_promoteur_payment_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);
    return NextResponse.json({
      received: true, candidateId: candidate.id, status: "manual_review",
      message: "Notification reçue comme indice. Le titre de notification n'authentifie pas le SMS ; partagez le SMS original pour établir la preuve de débit de niveau 1.",
    }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Collecte de notification Promoteur indisponible." }, { status: 503 });
  }
}

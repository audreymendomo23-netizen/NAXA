import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deviceTokenFromRequest, hashDeviceToken } from "@/lib/appareil-token";
import { parsePromoteurPaymentSms } from "@/lib/promoteurPaymentSms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  partnerId?: string; deviceId?: string; deviceToken?: string;
  canal?: "orange_money" | "mtn_momo"; smsText?: string;
  sourceType?: "notification_listener_candidate" | "voluntary_sms_share";
  senderTitle?: string; sourcePackage?: string; receivedAt?: string;
};

export async function POST(request: Request) {
  try {
    const accessToken = deviceTokenFromRequest(request);
    const body = await request.json() as Body;
    const canal = body.canal;
    const sourceType = body.sourceType ?? "voluntary_sms_share";
    const smsText = String(body.smsText ?? "").trim().slice(0, 8000);
    const senderTitle = String(body.senderTitle ?? "").trim();
    const receivedAt = new Date(String(body.receivedAt ?? new Date().toISOString()));
    if (!accessToken || !body.partnerId || !body.deviceId || String(body.deviceToken ?? "").length < 32 ||
        (canal !== "orange_money" && canal !== "mtn_momo") || smsText.length < 12 ||
        !["notification_listener_candidate", "voluntary_sms_share"].includes(sourceType) ||
        !Number.isFinite(receivedAt.getTime()) || receivedAt.getTime() > Date.now() + 60_000 ||
        receivedAt.getTime() < Date.now() - 24 * 60 * 60_000 ||
        (sourceType === "notification_listener_candidate" &&
          senderTitle !== (canal === "orange_money" ? "OrangeMoney" : "MobileMoney"))) {
      return NextResponse.json({ error: "Élément de paiement Partenaire incomplet ou invalide." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data: auth, error: authError } = await db.auth.getUser(accessToken);
    if (authError || !auth.user) return NextResponse.json({ error: "Session Partenaire invalide ou expirée." }, { status: 401 });
    const { data: profile } = await db.from("profiles").select("actif").eq("id", auth.user.id).maybeSingle();
    if (profile?.actif !== true) return NextResponse.json({ error: "Compte actif requis." }, { status: 403 });

    const { data: device } = await db.from("naxa_partner_payment_devices")
      .select("id,partner_id,user_id,is_active,device_token_hash")
      .eq("id", body.deviceId).eq("partner_id", body.partnerId).eq("user_id", auth.user.id).maybeSingle();
    if (!device || device.is_active !== true || device.device_token_hash !== hashDeviceToken(String(body.deviceToken))) {
      return NextResponse.json({ error: "Appareil Partenaire non enrôlé." }, { status: 403 });
    }
    const { data: membership } = await db.from("partner_members")
      .select("partner_id,partners!inner(status)").eq("partner_id", body.partnerId)
      .eq("user_id", auth.user.id).in("member_role", ["owner", "manager"]).maybeSingle();
    if (!membership || (membership as any).partners?.status !== "active") {
      return NextResponse.json({ error: "Accès propriétaire/gestionnaire révoqué ou partenaire suspendu." }, { status: 403 });
    }

    const parsed = parsePromoteurPaymentSms(smsText, canal);
    if (!parsed || parsed.direction !== "payer_debit" || parsed.success !== true) {
      return NextResponse.json({ error: "Le message ne contient pas un débit Mobile Money reconnu. Il reste à transmettre par une autre voie de vérification." }, { status: 422 });
    }
    const payloadHash = createHash("sha256").update(smsText).digest("hex");
    const { data: candidate, error } = await db.from("naxa_partner_payment_notification_candidates").insert({
      partner_id: body.partnerId,
      user_id: auth.user.id,
      device_id: device.id,
      canal,
      source_type: sourceType,
      sender_title: sourceType === "notification_listener_candidate" ? senderTitle : null,
      source_package: sourceType === "notification_listener_candidate" ? String(body.sourcePackage ?? "").slice(0, 180) : null,
      transaction_direction: parsed.direction,
      amount: parsed.amount,
      transaction_reference: parsed.reference,
      payer_number: parsed.payerNumber,
      merchant_number: parsed.merchantNumber,
      provider_occurred_at: parsed.occurredAt,
      received_at: receivedAt.toISOString(),
      payload_sha256: payloadHash,
      status: "manual_review",
    }).select("id").single();
    if (error?.code === "23505") return NextResponse.json({ received: true, status: "duplicate" }, { status: 409 });
    if (error || !candidate) return NextResponse.json({ error: "Enregistrement de l'élément de paiement impossible." }, { status: 503 });

    const { data: admins } = await db.from("profiles").select("id").eq("role", "admin").eq("actif", true);
    if (admins?.length) await db.from("notifications").insert(admins.map((admin: {id:string}) => ({
      user_id: admin.id, type: "abonnement_capture_admin_a_revoir",
      titre: "Paiement Partenaire à rapprocher",
      corps: "Un élément de paiement a été reçu pour un Partenaire (" + canal + ", " +
        String(parsed.amount ?? "montant non extrait") + " FCFA). Aucun abonnement n'est activé : cycle de facturation Partenaire à vérifier.",
    })));
    await db.from("naxa_partner_payment_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);
    return NextResponse.json({
      received: true, candidateId: candidate.id, status: "manual_review",
      message: "Élément reçu par NAXA. Il reste à rapprocher manuellement ; aucune activation d'abonnement n'est déclenchée.",
    }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Collecte du paiement Partenaire indisponible." }, { status: 503 });
  }
}

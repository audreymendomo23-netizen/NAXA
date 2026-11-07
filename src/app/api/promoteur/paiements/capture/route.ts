import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deviceTokenFromRequest, hashDeviceToken } from "@/lib/appareil-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CaptureBody = {
  deviceId?: string;
  deviceToken?: string;
  canal?: "mtn_momo" | "orange_money";
  transactionReference?: string;
  amount?: number;
  currency?: string;
  recipientReference?: string;
  senderAccountMasked?: string;
  occurredAt?: string;
};

const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export async function POST(request: Request) {
  try {
    const accessToken = deviceTokenFromRequest(request);
    const body = await request.json() as CaptureBody;
    const deviceId = String(body.deviceId ?? "");
    const deviceToken = String(body.deviceToken ?? "");
    const canal = body.canal;
    const transactionReference = String(body.transactionReference ?? "").trim().slice(0, 160);
    const amount = Number(body.amount);
    const currency = String(body.currency ?? "");
    const recipientReference = String(body.recipientReference ?? "").trim().slice(0, 160);
    const senderAccountMasked = String(body.senderAccountMasked ?? "").trim().slice(0, 40) || "non_lisible";
    const occurredAt = new Date(String(body.occurredAt ?? ""));
    if (!accessToken || !deviceId || deviceToken.length < 32 || !["mtn_momo", "orange_money"].includes(String(canal))
      || transactionReference.length < 3 || !Number.isSafeInteger(amount) || amount <= 0 || currency !== "FCFA"
      || !Number.isFinite(occurredAt.getTime())) {
      return NextResponse.json({ error: "Capture Android incomplète ou invalide." }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { data: auth, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !auth.user) return NextResponse.json({ error: "Session Promoteur invalide ou expirée." }, { status: 401 });
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("role,actif").eq("id", auth.user.id).maybeSingle();
    if (profileError || profile?.role !== "promoteur" || profile.actif !== true) {
      return NextResponse.json({ error: "Un compte Promoteur actif est requis pour transmettre une capture." }, { status: 403 });
    }
    const { data: device, error: deviceError } = await admin.from("naxa_promoteur_payment_devices")
      .select("id,promoteur_id,is_active,device_token_hash")
      .eq("id", deviceId).eq("promoteur_id", auth.user.id).maybeSingle();
    if (deviceError || !device || device.is_active !== true || device.device_token_hash !== hashDeviceToken(deviceToken)) {
      return NextResponse.json({ error: "Téléphone non enrôlé pour ce compte Promoteur." }, { status: 403 });
    }
    const now = new Date();
    if (occurredAt.getTime() > now.getTime() + 5 * 60_000 || occurredAt.getTime() < now.getTime() - 24 * 60 * 60_000) {
      return NextResponse.json({ error: "Date de notification hors fenêtre autorisée." }, { status: 400 });
    }
    await admin.from("naxa_promoteur_payment_devices")
      .update({ last_seen_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("id", deviceId).eq("promoteur_id", auth.user.id);

    const { data: intent, error: intentError } = await admin.from("naxa_promoteur_payment_intents")
      .select("id,canal,expected_amount,currency,destination_snapshot,expires_at,created_at,status")
      .eq("promoteur_id", auth.user.id).eq("device_id", deviceId)
      .eq("status", "awaiting_payment").gt("expires_at", now.toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (intentError || !intent) return NextResponse.json({ error: "Aucun paiement actif n'est associé à ce téléphone." }, { status: 409 });
    if (intent.canal !== canal) return NextResponse.json({ error: "Le canal de notification ne correspond pas au paiement préparé." }, { status: 409 });

    const destination = intent.destination_snapshot as { reference_destination?: string };
    const amountMatches = amount === intent.expected_amount && currency === intent.currency;
    const destinationMatches = Boolean(destination.reference_destination) &&
      normalize(recipientReference) === normalize(destination.reference_destination);
    const isMatched = amountMatches && destinationMatches;
    const payloadHash = createHash("sha256").update(JSON.stringify({
      deviceId, canal, transactionReference, amount, currency, recipientReference,
      senderAccountMasked, occurredAt: occurredAt.toISOString(),
    })).digest("hex");

    const { data: event, error: eventError } = await admin.from("naxa_promoteur_payment_capture_events").insert({
      promoteur_id: auth.user.id, device_id: deviceId, intent_id: intent.id, canal,
      transaction_reference: transactionReference, amount, currency,
      recipient_reference: recipientReference || null,
      sender_account_masked: senderAccountMasked,
      provider_occurred_at: occurredAt.toISOString(),
      payload_sha256: payloadHash,
      match_status: isMatched ? "matched" : "mismatch",
    }).select("id").single();
    if (eventError) {
      if (eventError.code === "23505") return NextResponse.json({ error: "Cette référence de transaction a déjà été reçue." }, { status: 409 });
      return NextResponse.json({ error: "Enregistrement sécurisé de la notification impossible." }, { status: 503 });
    }

    if (!isMatched) {
      await admin.from("naxa_promoteur_payment_intents").update({ status: "manual_review", updated_at: now.toISOString() }).eq("id", intent.id);
      const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin").eq("actif", true);
      if (admins?.length) {
        await admin.from("notifications").insert(admins.map((item: { id: string }) => ({
          user_id: item.id, type: "abonnement_capture_mobile_a_revoir",
          titre: "Notification de paiement à rapprocher",
          corps: "Une notification mobile money reçue par le compagnon Android ne correspond pas exactement au montant ou au bénéficiaire du paiement préparé. Aucun règlement ni renouvellement n'a été créé. Vérifiez le compte marchand.",
        })));
      }
      return NextResponse.json({
        received: true, eventId: event.id, status: "manual_review",
        message: "Notification reçue, mais le montant ou le bénéficiaire ne correspond pas exactement. Aucun règlement n'a été déclaré.",
      }, { status: 202 });
    }

    const { data: reglementId, error: submitError } = await admin.rpc("promoteur_soumettre_reglement", {
      p_promoteur: auth.user.id,
      p_montant: amount,
      p_canal: canal,
      p_canal_autre: null,
      p_compte_payeur: senderAccountMasked,
      p_reference: transactionReference,
      p_paye_le: occurredAt.toISOString(),
      p_preuve_path: null,
    });
    if (submitError || !reglementId) {
      await admin.from("naxa_promoteur_payment_intents").update({ status: "manual_review", updated_at: now.toISOString() }).eq("id", intent.id);
      await admin.from("naxa_promoteur_payment_capture_events").update({ match_status: "mismatch" }).eq("id", event.id);
      return NextResponse.json({ received: true, status: "manual_review", message: "La notification a été conservée pour examen. Déclaration du règlement non finalisée." }, { status: 202 });
    }
    await admin.from("naxa_promoteur_payment_intents").update({
      status: "submission_created", linked_reglement_id: reglementId, updated_at: now.toISOString(),
    }).eq("id", intent.id);
    await admin.from("naxa_promoteur_payment_capture_events").update({ match_status: "submitted" }).eq("id", event.id);
    return NextResponse.json({
      received: true, status: "pending_admin_confirmation",
      message: "Notification rapprochée. Le paiement reste en attente de vérification indépendante par NAXA.",
    }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Service de capture Android indisponible." }, { status: 503 });
  }
}

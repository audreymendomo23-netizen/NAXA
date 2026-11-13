import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deviceTokenFromRequest, hashDeviceToken } from "@/lib/appareil-token";
import { parsePromoteurPaymentSms } from "@/lib/promoteurPaymentSms";
import { interpretPromoteurPaymentSms } from "@/lib/promoteurPaymentSmsAI";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  deviceId?: string;
  deviceToken?: string;
  canal?: "orange_money" | "mtn_momo";
  smsText?: string;
  senderOriginAddress?: string;
  smsReceivedAt?: string;
};

const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const phoneTail = (value: string | null | undefined) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : "";
};
const samePhone = (left: string | null | undefined, right: string | null | undefined) => {
  const a = phoneTail(left);
  const b = phoneTail(right);
  return Boolean(a && b && a === b);
};

async function notifyAdmins(db: ReturnType<typeof supabaseAdmin>, message: string) {
  const { data: admins } = await db.from("profiles").select("id").eq("role", "admin").eq("actif", true);
  if (admins?.length) {
    await db.from("notifications").insert(admins.map((item: { id: string }) => ({
      user_id: item.id,
      type: "abonnement_capture_admin_a_revoir",
      titre: "SMS marchand à rapprocher",
      corps: message.slice(0, 900),
    })));
  }
}

export async function POST(request: Request) {
  try {
    const accessToken = deviceTokenFromRequest(request);
    const body = await request.json() as Body;
    const deviceId = String(body.deviceId ?? "");
    const deviceToken = String(body.deviceToken ?? "");
    const canal = body.canal;
    const smsText = String(body.smsText ?? "").trim().slice(0, 8000);
    const senderOriginAddress = String(body.senderOriginAddress ?? "").trim().slice(0, 80);
    const smsReceivedAt = new Date(String(body.smsReceivedAt ?? ""));

    if (!accessToken || !deviceId || deviceToken.length < 32 ||
        (canal !== "orange_money" && canal !== "mtn_momo") ||
        smsText.length < 12 || !senderOriginAddress || !Number.isFinite(smsReceivedAt.getTime())) {
      return NextResponse.json({ error: "Capture SMS Admin incomplete ou invalide." }, { status: 400 });
    }

    const now = new Date();
    if (smsReceivedAt.getTime() > now.getTime() + 60_000 ||
        smsReceivedAt.getTime() < now.getTime() - 24 * 60 * 60_000) {
      return NextResponse.json({ error: "Heure de reception SMS hors de la fenetre autorisee." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data: auth, error: authError } = await db.auth.getUser(accessToken);
    if (authError || !auth.user) return NextResponse.json({ error: "Session Administrateur invalide ou expiree." }, { status: 401 });
    const { data: profile, error: profileError } = await db.from("profiles")
      .select("id,role,actif").eq("id", auth.user.id).maybeSingle();
    if (profileError || profile?.role !== "admin" || profile.actif !== true) {
      return NextResponse.json({ error: "Un compte Administrateur actif est requis." }, { status: 403 });
    }

    const { data: device, error: deviceError } = await db.from("naxa_admin_payment_devices")
      .select("id,admin_id,device_name,canal,merchant_reference,device_token_hash,is_active")
      .eq("id", deviceId).eq("admin_id", auth.user.id).maybeSingle();
    if (deviceError || !device || device.is_active !== true ||
        device.device_token_hash !== hashDeviceToken(deviceToken) || device.canal !== canal) {
      return NextResponse.json({ error: "Telephone Admin non enrole pour ce canal." }, { status: 403 });
    }

    const { data: currentDestination, error: destinationError } = await db.from("naxa_payment_destinations")
      .select("reference_destination,beneficiaire")
      .eq("canal", canal).eq("actif", true).maybeSingle();
    if (destinationError || !currentDestination ||
        normalize(currentDestination.reference_destination) !== normalize(device.merchant_reference)) {
      return NextResponse.json({ error: "Le code marchand a change. Reenrolez le telephone Admin." }, { status: 409 });
    }

    const expectedSender = canal === "orange_money" ? "OrangeMoney" : "MobileMoney";
    if (normalize(senderOriginAddress) !== normalize(expectedSender) || /\d/.test(senderOriginAddress)) {
      await notifyAdmins(db, "Le telephone Admin a recu un SMS dont l'expediteur brut n'est pas l'identifiant officiel attendu. Aucun renouvellement automatique.");
      return NextResponse.json({ received: true, status: "manual_review", message: "Expediteur SMS non reconnu. Aucune confirmation automatique." }, { status: 202 });
    }

    const parsed = parsePromoteurPaymentSms(smsText, canal, senderOriginAddress) ??
      await interpretPromoteurPaymentSms(smsText, canal, senderOriginAddress);
    const providerAt = parsed?.occurredAt ? new Date(parsed.occurredAt) : null;
    const providerTimeValid = !providerAt ||
      (Number.isFinite(providerAt.getTime()) &&
       providerAt.getTime() <= smsReceivedAt.getTime() + 5 * 60_000 &&
       providerAt.getTime() >= smsReceivedAt.getTime() - 24 * 60 * 60_000);
    const merchantMatches = Boolean(
      parsed?.merchantNumber &&
      normalize(parsed.merchantNumber) === normalize(device.merchant_reference)
    ) || (canal === "mtn_momo" && !parsed?.merchantNumber);
    const completeCredit = Boolean(
      parsed &&
      parsed.direction === "merchant_credit" &&
      parsed.success === true &&
      parsed.quality === "complete" &&
      parsed.amount !== null &&
      parsed.amount > 0 &&
      parsed.reference &&
      parsed.reference.length >= 5 &&
      parsed.payerNumber &&
      phoneTail(parsed.payerNumber).length === 9 &&
      merchantMatches &&
      providerTimeValid
    );
    const reference = String(parsed?.reference ?? ("UNKNOWN-" + createHash("sha256").update(smsText).digest("hex").slice(0, 18))).slice(0, 160);
    const bodyHash = createHash("sha256").update(smsText).digest("hex");
    const payloadHash = createHash("sha256").update(JSON.stringify({
      deviceId, canal, reference, parsedAmount: parsed?.amount ?? null, senderOriginAddress,
      smsReceivedAt: smsReceivedAt.toISOString(), bodyHash,
    })).digest("hex");

    if (!parsed || !completeCredit || parsed.amount === null) {
      const { data: admins } = await db.from("profiles").select("id").eq("role", "admin").eq("actif", true);
      if (admins?.length) await db.from("notifications").insert(admins.map((item: { id: string }) => ({
        user_id: item.id, type: "abonnement_capture_admin_a_revoir",
        titre: "SMS marchand incomplet",
        corps: "Un SMS recu sur le telephone Admin n'a pas pu etre rapproche avec certitude. La preuve doit etre traitee manuellement.",
      })));
      return NextResponse.json({ received: true, status: "manual_review", message: "SMS marchand incomplet ou non reconnu. Le paiement reste a verifier manuellement." }, { status: 202 });
    }

    const { data: pendingRows, error: pendingError } = await db.from("abonnement_promoteur_reglements")
      .select("id,promoteur_id,montant,canal,compte_payeur,paye_le,declared_at,verification_deadline_at,destination_snapshot,statut")
      .eq("statut", "en_attente").eq("canal", canal).eq("montant", parsed.amount)
      .lte("declared_at", new Date(smsReceivedAt.getTime() + 5 * 60_000).toISOString())
      .gte("verification_deadline_at", smsReceivedAt.toISOString())
      .order("declared_at", { ascending: false }).limit(100);
    if (pendingError) return NextResponse.json({ error: "Recherche des declarations en attente impossible." }, { status: 503 });

    const pendingMatches = (pendingRows ?? []).filter(row => {
      const snapshot = row.destination_snapshot as { reference_destination?: string } | null;
      const destinationReference = snapshot?.reference_destination;
      if (typeof destinationReference !== "string" || !destinationReference ||
          normalize(destinationReference) !== normalize(device.merchant_reference)) return false;
      const declaredPhone = phoneTail(row.compte_payeur);
      if (!declaredPhone || declaredPhone !== phoneTail(parsed.payerNumber)) return false;
      if (providerAt && row.paye_le) {
        const paid = new Date(row.paye_le).getTime();
        if (providerAt.getTime() < paid - 15 * 60_000 || providerAt.getTime() > paid + 30 * 60_000) return false;
      }
      return true;
    });

    if (pendingMatches.length > 1) {
      const { data: event, error: eventError } = await db.from("naxa_admin_payment_capture_events").insert({
        admin_id: auth.user.id,
        device_id: device.id,
        reglement_id: null,
        canal,
        direction: "merchant_credit",
        success: true,
        transaction_reference: reference,
        amount: parsed.amount,
        currency: "FCFA",
        payer_number: phoneTail(parsed.payerNumber),
        merchant_reference: device.merchant_reference,
        sender_origin_id: senderOriginAddress,
        provider_occurred_at: parsed.occurredAt,
        sms_received_at: smsReceivedAt.toISOString(),
        payload_sha256: payloadHash,
        match_status: "ambiguous",
      }).select("id").single();
      if (eventError?.code === "23505") return NextResponse.json({ received: true, status: "duplicate" }, { status: 409 });
      if (eventError || !event) return NextResponse.json({ error: "Conservation de l'evenement ambigu impossible." }, { status: 503 });
      await notifyAdmins(db, "Plusieurs reglements en attente correspondent au canal, montant, code marchand et payeur. Reference " + reference + ". Aucun renouvellement automatique.");
      return NextResponse.json({ received: true, eventId: event.id, status: "ambiguous" }, { status: 202 });
    }

    let reglementId: string | null = pendingMatches.length === 1 ? pendingMatches[0].id : null;

    if (!reglementId) {
      const { data: event, error: eventError } = await db.from("naxa_admin_payment_capture_events").insert({
        admin_id: auth.user.id,
        device_id: device.id,
        reglement_id: null,
        canal,
        direction: "merchant_credit",
        success: true,
        transaction_reference: reference,
        amount: parsed.amount,
        currency: "FCFA",
        payer_number: phoneTail(parsed.payerNumber),
        merchant_reference: device.merchant_reference,
        sender_origin_id: senderOriginAddress,
        provider_occurred_at: parsed.occurredAt,
        sms_received_at: smsReceivedAt.toISOString(),
        payload_sha256: payloadHash,
        match_status: "manual_review",
      }).select("id").single();
      if (eventError?.code === "23505") return NextResponse.json({ received: true, status: "duplicate" }, { status: 409 });
      if (eventError || !event) return NextResponse.json({ error: "Conservation de l'evenement Admin impossible." }, { status: 503 });
      await notifyAdmins(db, "SMS de crédit reçu, mais aucune déclaration de débit Promoteur correspondante n'existe. Le SMS seul ne crée ni règlement ni renouvellement. Référence " + reference + ".");
      return NextResponse.json({
        received: true, eventId: event.id, status: "manual_review",
        message: "SMS de crédit conservé. Le Promoteur doit d'abord transmettre sa preuve de débit, ou l'Admin doit procéder à une vérification manuelle.",
      }, { status: 202 });
    }

    const referenceRpc = await db.rpc("naxa_promoteur_payment_add_reference", {
      p_reglement: reglementId,
      p_canal: canal,
      p_reference: parsed.reference,
      p_source_level: 2,
      p_source_type: "merchant_sms",
      p_provider_occurred_at: parsed.occurredAt,
      p_sms_received_at: smsReceivedAt.toISOString(),
      p_payload_sha256: payloadHash,
    });
    if (referenceRpc.error) {
      return NextResponse.json({ received: true, status: "manual_review", message: "Reference ou dossier en conflit. Confirmation automatique refusee." }, { status: 202 });
    }

    const { data: event, error: eventError } = await db.from("naxa_admin_payment_capture_events").insert({
      admin_id: auth.user.id,
      device_id: device.id,
      reglement_id: reglementId,
      canal,
      direction: "merchant_credit",
      success: true,
      transaction_reference: reference,
      amount: parsed.amount,
      currency: "FCFA",
      payer_number: phoneTail(parsed.payerNumber),
      merchant_reference: device.merchant_reference,
      sender_origin_id: senderOriginAddress,
      provider_occurred_at: parsed.occurredAt,
      sms_received_at: smsReceivedAt.toISOString(),
      payload_sha256: payloadHash,
      match_status: "matched",
    }).select("id").single();
    if (eventError) {
      if (eventError.code === "23505") return NextResponse.json({ received: true, status: "duplicate", message: "Cette reference a deja ete recue dans NAXA." }, { status: 409 });
      return NextResponse.json({ error: "Enregistrement du SMS marchand impossible." }, { status: 503 });
    }

    const { data: confirmation, error: confirmError } = await db.rpc("naxa_promoteur_payment_auto_confirm_admin_sms", {
      p_capture_event: event.id,
    });
    if (confirmError || !confirmation) {
      await db.from("naxa_admin_payment_capture_events").update({ match_status: "manual_review" }).eq("id", event.id);
      await notifyAdmins(db, "Le SMS marchand a ete rattache au paiement " + reference + ", mais la confirmation automatique a ete refusee. Verifiez le dossier dans le cockpit Admin.");
      return NextResponse.json({ received: true, eventId: event.id, status: "manual_review" }, { status: 202 });
    }

    return NextResponse.json({
      received: true,
      eventId: event.id,
      reglementId,
      status: "auto_confirmed_admin_sms",
      receipt: confirmation,
    }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Service de capture Admin indisponible." }, { status: 503 });
  }
}

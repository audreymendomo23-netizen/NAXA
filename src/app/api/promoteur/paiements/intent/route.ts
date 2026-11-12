import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deviceTokenFromRequest, hashDeviceToken } from "@/lib/appareil-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This endpoint is intentionally callable only by the enrolled Android companion.
// The web page cannot prepare an intent on behalf of a different physical device.
export async function POST(request: Request) {
  try {
    const accessToken = deviceTokenFromRequest(request);
    const deviceId = request.headers.get("x-naxa-device-id") || "";
    const deviceToken = request.headers.get("x-naxa-device-token") || "";
    if (!accessToken || !deviceId || deviceToken.length < 32) {
      return NextResponse.json({ error: "Session et jeton du téléphone enrôlé requis." }, { status: 401 });
    }
    const admin = supabaseAdmin();
    const { data: auth, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !auth.user) return NextResponse.json({ error: "Session NAXA invalide ou expirée." }, { status: 401 });
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("role,actif").eq("id", auth.user.id).maybeSingle();
    if (profileError || profile?.role !== "promoteur" || profile.actif !== true) {
      return NextResponse.json({ error: "Un compte Promoteur actif est requis." }, { status: 403 });
    }
    const { data: device, error: deviceError } = await admin.from("naxa_promoteur_payment_devices")
      .select("id,device_name,is_active,device_token_hash")
      .eq("id", deviceId).eq("promoteur_id", auth.user.id).maybeSingle();
    if (deviceError || !device || device.is_active !== true || device.device_token_hash !== hashDeviceToken(deviceToken)) {
      return NextResponse.json({ error: "Ce compagnon Android n'est pas enrôlé sur ce compte Promoteur." }, { status: 403 });
    }

    const body = await request.json() as { canal?: string };
    const canal = String(body.canal ?? "");
    if (!["mtn_momo", "orange_money"].includes(canal)) {
      return NextResponse.json({ error: "Choisissez MTN Mobile Money ou Orange Money." }, { status: 400 });
    }

    const [{ data: subscription, error: subscriptionError }, { data: destination, error: destinationError },
      { data: pendingRows, error: pendingError }] = await Promise.all([
      admin.from("abonnements_promoteurs").select("montant_mensuel").eq("promoteur_id", auth.user.id).maybeSingle(),
      admin.from("naxa_payment_destinations").select("canal,beneficiaire,reference_destination,instructions,updated_at")
        .eq("canal", canal).eq("actif", true).maybeSingle(),
      admin.from("abonnement_promoteur_reglements").select("id")
        .eq("promoteur_id", auth.user.id).in("statut", ["en_attente", "non_confirme"]).limit(1),
    ]);
    if (subscriptionError || !subscription?.montant_mensuel || destinationError || !destination || pendingError) {
      return NextResponse.json({ error: "Abonnement, tarif ou destination de paiement indisponible. Aucun paiement n'a été préparé." }, { status: 409 });
    }
    if ((pendingRows ?? []).length) return NextResponse.json({ error: "Un règlement est déjà en attente de vérification." }, { status: 409 });

    const now = new Date();
    await admin.from("naxa_promoteur_payment_intents").update({
      status: "expired", updated_at: now.toISOString(),
    }).eq("promoteur_id", auth.user.id).eq("status", "awaiting_payment").lte("expires_at", now.toISOString());

    const { data: intent, error: createError } = await admin.from("naxa_promoteur_payment_intents").insert({
      promoteur_id: auth.user.id,
      device_id: device.id,
      canal,
      expected_amount: subscription.montant_mensuel,
      currency: "FCFA",
      destination_snapshot: destination,
      status: "awaiting_payment",
      expires_at: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    }).select("id,canal,expected_amount,currency,destination_snapshot,expires_at,status").single();
    if (createError || !intent) {
      return NextResponse.json({ error: "Un paiement est peut-être déjà préparé. Actualisez l'espace Promoteur." }, { status: 409 });
    }
    await admin.from("naxa_promoteur_payment_devices")
      .update({ last_seen_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("id", device.id);
    return NextResponse.json({ intent }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Préparation du paiement impossible." }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { deviceTokenFromRequest } from "@/lib/appareil-token";
import { buildMerchantPaymentUssd } from "@/lib/merchant-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MerchantSnapshot = {
  merchant_name?: unknown;
  merchant_phone?: unknown;
  merchant_code?: unknown;
  canal?: unknown;
  partner_name?: unknown;
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Réservation partenaire invalide." }, { status: 400 });
    }

    const token = deviceTokenFromRequest(request);
    const db = supabaseAdmin();
    const authResult = token
      ? await db.auth.getUser(token)
      : await supabaseServer().auth.getUser();
    if (authResult.error || !authResult.data.user) {
      return NextResponse.json({ error: "Connexion Client requise." }, { status: 401 });
    }
    const userId = authResult.data.user.id;
    const canal = new URL(request.url).searchParams.get("canal");
    if (canal !== "orange_money" && canal !== "mtn_momo") {
      return NextResponse.json({ error: "Choisissez Orange Money ou MTN Mobile Money." }, { status: 400 });
    }

    const { data: reservation, error: reservationError } = await db
      .from("universe_reservations")
      .select("id,client_id,partner_id,status,total_fcfa,expires_at,payment_status")
      .eq("id", id).eq("client_id", userId).maybeSingle();

    if (reservationError || !reservation) {
      return NextResponse.json({ error: "Réservation introuvable." }, { status: 404 });
    }
    if (!["confirmed", "ready"].includes(reservation.status) ||
        new Date(reservation.expires_at).getTime() <= Date.now() ||
        Number(reservation.total_fcfa) <= 0 ||
        reservation.payment_status === "confirmed") {
      return NextResponse.json({ error: "Cette réservation n'est pas éligible au paiement électronique." }, { status: 409 });
    }

    const { data: rawIntent, error: intentError } = await db.rpc("naxa_universe_get_or_create_payment_intent", {
      p_reservation: id,
      p_client: userId,
      p_canal: canal,
    });
    if (intentError || !rawIntent || typeof rawIntent !== "object" || Array.isArray(rawIntent)) {
      return NextResponse.json({
        error: intentError?.message ?? "Impossible de préparer le paiement partenaire.",
      }, { status: 409 });
    }

    const intent = rawIntent as {
      id?: unknown; canal?: unknown; expected_amount?: unknown;
      destination_snapshot?: unknown; expires_at?: unknown; status?: unknown;
    };
    if (!intent.destination_snapshot || typeof intent.destination_snapshot !== "object" ||
        Array.isArray(intent.destination_snapshot)) {
      return NextResponse.json({ error: "Coordonnées marchandes figées invalides." }, { status: 409 });
    }
    const merchant = intent.destination_snapshot as MerchantSnapshot;
    const amount = Number(intent.expected_amount);
    const code = typeof merchant.merchant_code === "string" ? merchant.merchant_code : "";
    if (typeof intent.id !== "string" || intent.canal !== canal ||
        !Number.isSafeInteger(amount) || amount !== Number(reservation.total_fcfa) ||
        merchant.canal !== canal || typeof merchant.merchant_name !== "string" ||
        typeof merchant.merchant_phone !== "string" || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Instantané bénéficiaire / montant incohérent." }, { status: 409 });
    }

    return NextResponse.json({
      paymentIntentId: intent.id,
      status: intent.status,
      canal,
      merchant_name: merchant.merchant_name,
      merchant_phone: merchant.merchant_phone,
      merchant_code: code,
      total: amount,
      partner_name: typeof merchant.partner_name === "string" ? merchant.partner_name : null,
      expires_at: intent.expires_at,
      ussd: buildMerchantPaymentUssd(canal, code, amount),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Préparation du paiement partenaire indisponible." }, { status: 503 });
  }
}

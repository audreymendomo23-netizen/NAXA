import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { buildMerchantPaymentUssd } from "@/lib/merchant-payment";

export const dynamic = "force-dynamic";

type MerchantSnapshot = {
  merchant_name?: unknown;
  merchant_phone?: unknown;
  merchant_code?: unknown;
  canal?: unknown;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const sb = supabaseServer();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Connexion Client requise." }, { status: 401 });

    const { data: reservation, error } = await sb
      .from("reservations")
      .select("client_id,total,frais_livraison,pharmacie_id,statut,expires_at,mode,paiement_mode,paiement_statut,commande_statut,livraison_confirmee_stock_at")
      .eq("id", id)
      .eq("client_id", auth.user.id)
      .single();

    if (error || !reservation) return NextResponse.json({}, { status: 404 });

    const isDelivery = reservation.mode === "commande";
    if (isDelivery) {
      const eligible = Boolean(
        reservation.livraison_confirmee_stock_at
        && ["acceptee", "preparation", "livreur_assigne", "en_livraison"].includes(reservation.commande_statut ?? "")
        && ["mtn_marchand", "orange_money"].includes(reservation.paiement_mode ?? "")
        && reservation.paiement_statut !== "effectue"
      );
      if (!eligible) return NextResponse.json({ error: "La pharmacie doit confirmer la livraison et le mode de paiement doit être électronique." }, { status: 409 });
    } else if (!["en_attente", "confirmee"].includes(reservation.statut)) {
      return NextResponse.json({ error: "Réservation non payable." }, { status: 409 });
    }

    if (!reservation.expires_at || new Date(reservation.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "Le délai de réservation est dépassé." }, { status: 410 });
    }

    const channel = reservation.paiement_mode === "mtn_marchand" || reservation.paiement_mode === "mtn_momo"
      ? "mtn_momo"
      : reservation.paiement_mode === "orange_money" ? "orange_money" : null;
    if (!channel) return NextResponse.json({ error: "Sélectionnez d'abord un opérateur de paiement." }, { status: 409 });

    const db = supabaseAdmin();
    const fraisLivraison = isDelivery ? Number(reservation.frais_livraison ?? 0) : 0;
    const expectedAmount = Number(reservation.total) + fraisLivraison;
    if (!Number.isSafeInteger(expectedAmount) || expectedAmount <= 0) {
      return NextResponse.json({ error: "Montant de paiement invalide." }, { status: 409 });
    }

    let merchant: MerchantSnapshot;
    let amount = expectedAmount;
    let paymentIntentId: string | null = null;
    let intentExpiresAt: string | null = null;

    if (isDelivery) {
      const { data: intentData, error: intentError } = await db.rpc("naxa_delivery_get_or_create_payment_intent", {
        p_reservation: id,
        p_client: auth.user.id,
        p_canal: channel,
      });
      if (intentError || !intentData || typeof intentData !== "object" || Array.isArray(intentData)) {
        return NextResponse.json({
          error: "Impossible de figer les coordonnées marchandes de cette commande. Vérifiez la configuration de la pharmacie.",
        }, { status: 409 });
      }

      const intent = intentData as {
        id?: unknown;
        canal?: unknown;
        expected_amount?: unknown;
        destination_snapshot?: unknown;
        expires_at?: unknown;
      };
      const snapshotValue = intent.destination_snapshot;
      if (!snapshotValue || typeof snapshotValue !== "object" || Array.isArray(snapshotValue)) {
        return NextResponse.json({ error: "Instantané du bénéficiaire de paiement invalide." }, { status: 409 });
      }
      merchant = snapshotValue as MerchantSnapshot;
      amount = Number(intent.expected_amount);
      paymentIntentId = typeof intent.id === "string" ? intent.id : null;
      intentExpiresAt = typeof intent.expires_at === "string" ? intent.expires_at : null;

      if (!paymentIntentId || intent.canal !== channel || amount !== expectedAmount ||
          merchant.canal !== channel ||
          typeof merchant.merchant_name !== "string" ||
          typeof merchant.merchant_phone !== "string" ||
          typeof merchant.merchant_code !== "string" ||
          !/^\d{6}$/.test(merchant.merchant_code)) {
        return NextResponse.json({ error: "Instantané de paiement incomplet ou incohérent avec la commande." }, { status: 409 });
      }
    } else {
      const destinationQuery = db.from("naxa_merchant_payment_destinations")
        .select("merchant_name,merchant_phone,merchant_code,canal,is_active")
        .eq("pharmacie_id", reservation.pharmacie_id)
        .eq("canal", channel)
        .eq("is_active", true);
      const { data: destination, error: destinationError } = await destinationQuery.maybeSingle();

      if (destinationError || !destination || destination.canal !== channel ||
          !/^\d{6}$/.test(destination.merchant_code ?? "")) {
        return NextResponse.json({ error: "La pharmacie n'a pas encore activé ses coordonnées marchandes pour cet opérateur." }, { status: 409 });
      }
      merchant = destination;
    }

    const merchantCode = String(merchant.merchant_code);
    const ussd = buildMerchantPaymentUssd(channel, merchantCode, amount);

    return NextResponse.json(
      {
        canal: channel,
        merchant_name: merchant.merchant_name,
        merchant_phone: merchant.merchant_phone,
        merchant_code: merchantCode,
        code_marchand: merchantCode,
        total: amount,
        total_articles: Number(reservation.total),
        frais_livraison: fraisLivraison,
        mode: isDelivery ? "livraison" : "reservation",
        ...(paymentIntentId ? { payment_intent_id: paymentIntentId, intent_expires_at: intentExpiresAt } : {}),
        ussd,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Le paiement est momentanément indisponible." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

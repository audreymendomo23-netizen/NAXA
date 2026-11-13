import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { buildMerchantPaymentUssd } from "@/lib/merchant-payment";

export const dynamic = "force-dynamic";

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

    const { data: destination, error: destinationError } = await supabaseAdmin()
      .from("naxa_merchant_payment_destinations")
      .select("merchant_name,merchant_phone,merchant_code,canal,is_active")
      .eq("pharmacie_id", reservation.pharmacie_id)
      .eq("canal", channel)
      .eq("is_active", true)
      .maybeSingle();

    if (destinationError || !destination || destination.canal !== channel ||
        !/^\d{6}$/.test(destination.merchant_code ?? "")) {
      return NextResponse.json({ error: "La pharmacie n'a pas encore activé ses coordonnées marchandes pour cet opérateur." }, { status: 409 });
    }

    const fraisLivraison = isDelivery ? Number(reservation.frais_livraison ?? 0) : 0;
    const amount = Number(reservation.total) + fraisLivraison;
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: "Montant de paiement invalide." }, { status: 409 });
    }

    const ussd = buildMerchantPaymentUssd(channel, destination.merchant_code, amount);

    return NextResponse.json(
      {
        canal: channel,
        merchant_name: destination.merchant_name,
        merchant_phone: destination.merchant_phone,
        merchant_code: destination.merchant_code,
        code_marchand: destination.merchant_code,
        total: amount,
        total_articles: Number(reservation.total),
        frais_livraison: fraisLivraison,
        mode: isDelivery ? "livraison" : "reservation",
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

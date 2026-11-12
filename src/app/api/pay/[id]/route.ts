import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const { data: reservation, error } = await supabaseServer()
      .from("reservations")
      .select("total,frais_livraison,pharmacie_id,statut,expires_at,mode,paiement_mode,paiement_statut,commande_statut,livraison_confirmee_stock_at")
      .eq("id", id)
      .single();

    if (error || !reservation) return NextResponse.json({}, { status: 404 });

    const isDelivery = reservation.mode === "commande";
    if (isDelivery) {
      const eligible = Boolean(
        reservation.livraison_confirmee_stock_at
        && ["acceptee", "preparation", "livreur_assigne"].includes(reservation.commande_statut ?? "")
        && ["mtn_marchand", "orange_money"].includes(reservation.paiement_mode ?? "")
        && reservation.paiement_statut !== "effectue"
      );
      if (!eligible) return NextResponse.json({ error: "La pharmacie doit confirmer la livraison et le mode de paiement doit être électronique." }, { status: 409 });
    } else {
      if (!["en_attente", "confirmee"].includes(reservation.statut)) {
        return NextResponse.json({ error: "Réservation non payable." }, { status: 409 });
      }
    }

    if (!reservation.expires_at || new Date(reservation.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "Le délai de réservation est dépassé." }, { status: 410 });
    }

    const { data: privateData, error: privateError } = await supabaseAdmin()
      .from("pharmacie_privee")
      .select("code_marchand")
      .eq("pharmacie_id", reservation.pharmacie_id)
      .single();

    if (privateError || !privateData?.code_marchand) {
      return NextResponse.json({}, { status: 404 });
    }

    const fraisLivraison = isDelivery ? Number(reservation.frais_livraison ?? 0) : 0;
    const amount = Number(reservation.total) + fraisLivraison;
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: "Montant de paiement invalide." }, { status: 409 });
    }

    return NextResponse.json(
      {
        code_marchand: privateData.code_marchand,
        total: amount,
        total_articles: Number(reservation.total),
        frais_livraison: fraisLivraison,
        mode: isDelivery ? "livraison" : "reservation",
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

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { deviceTokenFromRequest } from "@/lib/appareil-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const token = deviceTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Session Client requise." }, { status: 401 });
    const db = supabaseAdmin();
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Session invalide ou expirée." }, { status: 401 });
    const { data, error } = await db.from("reservations")
      .select("id,total,frais_livraison,paiement_mode,paiement_statut,commande_statut,livraison_confirmee_stock_at,created_at,pharmacies(nom)")
      .eq("client_id", auth.user.id).eq("mode", "commande")
      .not("livraison_confirmee_stock_at", "is", null)
      .in("paiement_mode", ["mtn_marchand", "orange_money"])
      .neq("paiement_statut", "effectue")
      .in("commande_statut", ["acceptee", "preparation", "livreur_assigne", "en_livraison"])
      .order("created_at", { ascending: false }).limit(30);
    if (error) return NextResponse.json({ error: "Commandes payables indisponibles." }, { status: 503 });
    const orders = (data ?? []).map((row: any) => ({
      id: row.id,
      pharmacyName: row.pharmacies?.nom ?? "Pharmacie",
      channel: row.paiement_mode === "mtn_marchand" ? "mtn_momo" : "orange_money",
      expectedAmount: Number(row.total ?? 0) + Number(row.frais_livraison ?? 0),
      paymentStatus: row.paiement_statut,
      commandStatus: row.commande_statut,
      createdAt: row.created_at,
    })).filter(row => Number.isSafeInteger(row.expectedAmount) && row.expectedAmount > 0);
    return NextResponse.json({ orders }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Lecture des commandes payables impossible." }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const { data: r, error } = await supabaseServer()
      .from("reservations")
      .select("total,pharmacie_id,statut,expires_at")
      .eq("id", id)
      .single();

    if (error || !r) return NextResponse.json({}, { status: 404 });
    if (!["en_attente", "confirmee"].includes(r.statut)) {
      return NextResponse.json({ error: "Réservation non payable." }, { status: 409 });
    }
    if (!r.expires_at || new Date(r.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "Le délai de réservation est dépassé." }, { status: 410 });
    }

    const { data: priv, error: privateError } = await supabaseAdmin()
      .from("pharmacie_privee")
      .select("code_marchand")
      .eq("pharmacie_id", r.pharmacie_id)
      .single();

    if (privateError || !priv?.code_marchand) {
      return NextResponse.json({}, { status: 404 });
    }

    return NextResponse.json(
      { code_marchand: priv.code_marchand, total: r.total },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Le paiement est momentanément indisponible." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

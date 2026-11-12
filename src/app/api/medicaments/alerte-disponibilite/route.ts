import { NextResponse } from "next/server";
import { authenticateSupabaseBearer } from "@/lib/supabase/bearer-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { produitId?: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const auth = await authenticateSupabaseBearer(request);
  if (!auth.ok) return NextResponse.json({ error: "Connectez-vous pour activer cette alerte." }, { status: auth.status });

  let body: Body;
  try { body = await request.json() as Body; }
  catch { return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 }); }
  if (!body.produitId || !uuid.test(body.produitId)) {
    return NextResponse.json({ error: "Produit local invalide." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: product, error: productError } = await db.from("produits")
    .select("id,nom,fiche_validee").eq("id", body.produitId).maybeSingle();
  if (productError || !product || product.fiche_validee !== true) {
    return NextResponse.json({ error: "Ce produit ne peut pas encore recevoir d'alerte de disponibilité." }, { status: 404 });
  }

  const { data: pairs, error: pairError } = await db.from("stocks")
    .select("pharmacie_id,pharmacies!inner(actif,visible_recherche,archivee_le,est_demo)")
    .eq("produit_id", body.produitId)
    .eq("pharmacies.actif", true)
    .eq("pharmacies.visible_recherche", true)
    .is("pharmacies.archivee_le", null)
    .eq("pharmacies.est_demo", false)
    .limit(500);
  if (pairError) return NextResponse.json({ error: "Vérification du réseau partenaire impossible." }, { status: 503 });

  for (const pair of pairs ?? []) {
    const { data, error } = await db.rpc("marketplace_offre_stock_disponible", {
      p_pharmacie: pair.pharmacie_id,
      p_produit: body.produitId,
    });
    if (error) return NextResponse.json({ error: "Vérification du stock impossible. Réessayez." }, { status: 503 });
    const offer = Array.isArray(data) ? data[0] : data;
    if (Number(offer?.quantite ?? 0) > 0) {
      return NextResponse.json({ error: "Ce produit est déjà disponible chez un partenaire. Consultez les offres actuelles." }, { status: 409 });
    }
  }

  const { error } = await db.from("client_product_availability_alerts").upsert({
    user_id: auth.user.id,
    produit_id: body.produitId,
    active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,produit_id" });
  if (error) return NextResponse.json({ error: "Enregistrement de l'alerte impossible." }, { status: 503 });
  return NextResponse.json({ ok: true, message: "Vous serez averti lorsqu'une pharmacie partenaire confirmera un stock vendable." });
}

export async function DELETE(request: Request) {
  const auth = await authenticateSupabaseBearer(request);
  if (!auth.ok) return NextResponse.json({ error: "Connexion requise." }, { status: auth.status });
  let body: Body;
  try { body = await request.json() as Body; }
  catch { return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 }); }
  if (!body.produitId || !uuid.test(body.produitId)) return NextResponse.json({ error: "Produit invalide." }, { status: 400 });

  const { error } = await supabaseAdmin().from("client_product_availability_alerts")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("user_id", auth.user.id).eq("produit_id", body.produitId);
  if (error) return NextResponse.json({ error: "Désactivation de l'alerte impossible." }, { status: 503 });
  return NextResponse.json({ ok: true });
}

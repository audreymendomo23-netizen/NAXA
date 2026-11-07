import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PharmacyDutyRow = {
  id: string;
  nom: string;
  ville: string | null;
  region: string | null;
  de_garde: boolean;
  garde_debut: string | null;
  garde_fin: string | null;
  garde_source_url: string | null;
  garde_verifiee_le: string | null;
};

async function adminContext() {
  const auth = supabaseServer();
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) {
    return { response: NextResponse.json({ error: "Authentification requise." }, { status: 401 }) };
  }
  const [{ data: profile, error: profileError }, { data: activeRole, error: roleError }] = await Promise.all([
    auth.from("profiles").select("role,actif").eq("id", user.id).maybeSingle(),
    auth.rpc("naxa_business_function"),
  ]);
  if (profileError || roleError || profile?.role !== "admin" || profile.actif !== true || activeRole !== "admin") {
    return { response: NextResponse.json({ error: "Accès réservé à un administrateur NAXA actif." }, { status: 403 }) };
  }
  try {
    return { db: supabaseAdmin() };
  } catch {
    return { response: NextResponse.json({ error: "Service administratif indisponible sur cet environnement." }, { status: 503 }) };
  }
}

export async function GET() {
  const context = await adminContext();
  if ("response" in context) return context.response;
  const { data, error } = await context.db.from("pharmacies")
    .select("id,nom,ville,region,de_garde,garde_debut,garde_fin,garde_source_url,garde_verifiee_le")
    .eq("actif", true)
    .eq("visible_recherche", true)
    .eq("est_demo", false)
    .is("archivee_le", null)
    .order("region", { ascending: true })
    .order("ville", { ascending: true })
    .order("nom", { ascending: true })
    .limit(1000);
  if (error) {
    return NextResponse.json({ error: "Impossible de charger les pharmacies partenaires." }, { status: 503 });
  }
  return NextResponse.json({ pharmacies: (data ?? []) as PharmacyDutyRow[] }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const context = await adminContext();
  if ("response" in context) return context.response;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const pharmacyId = typeof body?.pharmacyId === "string" ? body.pharmacyId : "";
  const action = body?.action;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pharmacyId)) {
    return NextResponse.json({ error: "Pharmacie non valide." }, { status: 400 });
  }

  if (action === "retirer") {
    const { data, error } = await context.db.from("pharmacies").update({
      de_garde: false,
      garde_debut: null,
      garde_fin: null,
      garde_source_url: null,
      garde_verifiee_le: null,
    }).eq("id", pharmacyId).eq("actif", true).eq("est_demo", false).is("archivee_le", null)
      .select("id").maybeSingle();
    if (error) return NextResponse.json({ error: "Impossible de retirer cette garde." }, { status: 503 });
    if (!data) return NextResponse.json({ error: "Pharmacie partenaire introuvable ou inactive." }, { status: 404 });
    return NextResponse.json({ ok: true, action: "retirer" });
  }

  if (action !== "publier") {
    return NextResponse.json({ error: "Action non reconnue." }, { status: 400 });
  }

  const startRaw = typeof body?.debut === "string" ? body.debut : "";
  const endRaw = typeof body?.fin === "string" ? body.fin : "";
  const sourceRaw = typeof body?.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  const now = Date.now();
  const duration = end.getTime() - start.getTime();
  const maxDuration = 14 * 24 * 60 * 60 * 1000;
  const maxFutureStart = 90 * 24 * 60 * 60 * 1000;

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || duration <= 0) {
    return NextResponse.json({ error: "Indiquez une période de garde valide." }, { status: 400 });
  }
  if (duration > maxDuration || start.getTime() < now - maxDuration || start.getTime() > now + maxFutureStart || end.getTime() <= now) {
    return NextResponse.json({ error: "La période doit être en cours ou à venir, ne pas être expirée et ne pas dépasser 14 jours." }, { status: 400 });
  }

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(sourceRaw);
    if (sourceUrl.protocol !== "https:" || !sourceUrl.hostname.includes(".")) throw new Error("HTTPS requis");
  } catch {
    return NextResponse.json({ error: "Fournissez une URL HTTPS vers la source du planning." }, { status: 400 });
  }

  const { data, error } = await context.db.from("pharmacies").update({
    de_garde: true,
    garde_debut: start.toISOString(),
    garde_fin: end.toISOString(),
    garde_source_url: sourceUrl.toString(),
    garde_verifiee_le: new Date().toISOString(),
  }).eq("id", pharmacyId).eq("actif", true).eq("visible_recherche", true)
    .eq("est_demo", false).is("archivee_le", null)
    .select("id").maybeSingle();
  if (error) {
    return NextResponse.json({ error: "Publication impossible. Vérifiez que la migration des périodes de garde est appliquée." }, { status: 503 });
  }
  if (!data) {
    return NextResponse.json({ error: "Pharmacie partenaire introuvable, inactive ou non publiée." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, action: "publier", verifieeLe: new Date().toISOString() });
}

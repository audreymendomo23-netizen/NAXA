import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await sb
    .from("profiles")
    .select("role,pharmacie_id,actif")
    .eq("id", auth.user.id)
    .single();

  if (profileError || !profile?.actif || !["admin", "promoteur", "caisse", "pharmacie"].includes(profile.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  let pharmacyIds: string[] = [];
  if (profile.role === "promoteur") {
    // Les rapports Promoteur sont limités aux pharmacies explicitement liées
    // au compte. Le profil.pharmacie_id seul ne représente pas son réseau.
    const [{ data: valid, error: validityError }, { data: links, error: linksError }] = await Promise.all([
      sb.rpc("naxa_promoteur_valide", { p_promoteur: auth.user.id }),
      sb.from("promoteur_pharmacies")
        .select("pharmacie_id")
        .eq("promoteur_id", auth.user.id)
        .eq("actif", true),
    ]);

    if (validityError || valid !== true) {
      return NextResponse.json({ error: "Le compte Promoteur ou son abonnement n'est pas valide." }, { status: 403 });
    }
    if (linksError) {
      return NextResponse.json({ error: "Périmètre Promoteur indisponible." }, { status: 500 });
    }
    const linkedIds = [...new Set((links ?? []).map((link) => link.pharmacie_id).filter(Boolean))];
    if (!linkedIds.length) return NextResponse.json({ rapports: [] });

    // Le rapport Promoteur ne doit couvrir que le réseau effectivement
    // opérationnel : lien actif + pharmacie active et publiée.
    const { data: pharmacies, error: pharmaciesError } = await sb
      .from("pharmacies")
      .select("id")
      .in("id", linkedIds)
      .eq("actif", true)
      .eq("visible_recherche", true);
    if (pharmaciesError) {
      return NextResponse.json({ error: "Périmètre des rapports indisponible." }, { status: 500 });
    }
    pharmacyIds = [...new Set((pharmacies ?? []).map((pharmacy) => pharmacy.id).filter(Boolean))];
    if (!pharmacyIds.length) return NextResponse.json({ rapports: [] });
  } else if (profile.role !== "admin") {
    if (!profile.pharmacie_id) return NextResponse.json({ rapports: [] });
    pharmacyIds = [profile.pharmacie_id];
  }

  let query = sb
    .from("rapports")
    .select("id,portee,pharmacie_id,periode,du,au,texte,contenu,created_at,pharmacies(nom)")
    .order("created_at", { ascending: false })
    .limit(30);

  if (profile.role !== "admin") {
    // Ne jamais déduire un scope d'un simple rôle : la liste est issue du
    // lien réseau canonique (Promoteur) ou de la pharmacie du profil.
    query = query.in("pharmacie_id", pharmacyIds);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Rapports indisponibles" }, { status: 500 });

  return NextResponse.json({
    rapports: (data ?? []).map((report: any) => ({
      ...report,
      pharmacie_nom: report.pharmacies?.nom ?? null,
    })),
  });
}


export async function POST(request: Request) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });

  const { data: profile, error: profileError } = await sb.from("profiles")
    .select("role,actif").eq("id", auth.user.id).single();
  if (profileError || profile?.role !== "admin" || profile.actif === false) {
    return NextResponse.json({ error: "Seul un compte administrateur actif peut enregistrer un rapport réseau." }, { status: 403 });
  }

  let body: { jours?: number };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Paramètres de rapport invalides." }, { status: 400 });
  }
  const jours = Number(body.jours);
  if (![7, 30, 90].includes(jours)) return NextResponse.json({ error: "Choisissez une période de 7, 30 ou 90 jours." }, { status: 400 });

  const { data: stats, error: statsError } = await sb.rpc("stats_pilotage_scope", { p_jours: jours });
  if (statsError) return NextResponse.json({ error: "Les indicateurs du réseau n’ont pas pu être calculés. Aucun rapport n’a été enregistré." }, { status: 503 });
  const row = Array.isArray(stats) ? stats[0] : stats;
  const keys = ["pharmacies", "promoteurs", "produits", "reservations", "ventes", "demandes", "revenus"];
  if (!row || typeof row !== "object" || !keys.every((key) => key in row)) {
    return NextResponse.json({ error: "Les indicateurs renvoyés sont incomplets. Aucun rapport n’a été enregistré." }, { status: 502 });
  }

  const au = new Date();
  const du = new Date(au.getTime() - jours * 24 * 60 * 60 * 1000);
  const instantane = Object.fromEntries(keys.map((key) => [key, Number((row as Record<string, unknown>)[key] ?? 0)]));
  const contenu = { titre: "Rapport de pilotage NAXA", jours, genere_le: au.toISOString(), indicateurs: instantane };
  const texte = keys.map((key) => key + " : " + String(instantane[key as keyof typeof instantane])).join("\\n");
  const db = supabaseAdmin();
  const { data: saved, error: saveError } = await db.from("rapports").insert({
    portee: "admin",
    pharmacie_id: null,
    periode: jours + " derniers jours",
    du: du.toISOString().slice(0, 10),
    au: au.toISOString().slice(0, 10),
    texte,
    contenu,
  }).select("id,periode,du,au,texte,contenu,created_at").single();

  if (saveError || !saved) {
    return NextResponse.json({ error: "Le rapport a été calculé, mais son enregistrement a échoué. Vérifiez la structure et les autorisations de la table rapports." }, { status: 500 });
  }
  return NextResponse.json({ rapport: saved, instantane, genere_le: au.toISOString() }, { status: 201 });
}

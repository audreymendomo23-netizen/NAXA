import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

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
    .select("id,portee,pharmacie_id,scope_type,scope_profile_id,scope_pharmacie_id,periode,du,au,texte,contenu,created_at,pharmacies(nom)")
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

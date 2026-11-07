import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  calculerMatriceRoutiere,
  distanceVolOiseauKm,
  estCoordonneeCamerounaise,
  creerLienGoogleMaps,
} from "@/lib/server/delivery-routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PharmacieRow = {
  id: string; nom: string; ville: string | null; quartier: string | null; adresse: string | null;
  lat: number; lng: number; de_garde: boolean; livraison_active: boolean; rayon_livraison_km: number;
  horaires: string | null; photo_url: string | null; photo_verified_at: string | null; stock_updated_at: string | null;
};

export async function GET(request: NextRequest) {
  const client = {
    lat: Number(request.nextUrl.searchParams.get("lat")),
    lng: Number(request.nextUrl.searchParams.get("lng")),
  };
  if (!estCoordonneeCamerounaise(client)) {
    return NextResponse.json({ ok: false, error: "La position GPS doit se trouver au Cameroun." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const allRows: PharmacieRow[] = [];
  for (let offset = 0; offset < 50000; offset += 1000) {
    const { data: page, error } = await db.from("pharmacies")
      .select("id,nom,ville,quartier,adresse,lat,lng,de_garde,livraison_active,rayon_livraison_km,horaires,photo_url,photo_verified_at:photo_verifiee_le,stock_updated_at")
      .eq("actif", true)
      .eq("visible_recherche", true)
      .eq("est_demo", false)
      .is("archivee_le", null)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + 999);
    if (error) {
      return NextResponse.json({ ok: false, error: "Le réseau de pharmacies est momentanément indisponible." }, { status: 503 });
    }
    const rows = (page ?? []) as PharmacieRow[];
    allRows.push(...rows);
    if (rows.length < 1000) break;
  }

  const pharmacies = allRows
    .filter(p => estCoordonneeCamerounaise({ lat: Number(p.lat), lng: Number(p.lng) }))
    .map(p => ({ ...p, distanceVolOiseauKm: distanceVolOiseauKm(client, { lat: p.lat, lng: p.lng }) }))
    .sort((a, b) => a.distanceVolOiseauKm - b.distanceVolOiseauKm)
    .slice(0, 20);

  if (!pharmacies.length) {
    return NextResponse.json({
      ok: true, pharmacies: [], routeDisponible: true,
      message: "Aucune pharmacie partenaire NAXA géolocalisée dans le réseau pour le moment.",
    });
  }

  let routes: Array<{ distanceKm: number; dureeMinutes: number; fournisseur: "google_routes" | "osrm" } | null> = [];
  let routeDisponible = true;
  try {
    const { data: slot, error: slotError } = await db.rpc("naxa_reserve_api_rate_limit", {
      p_key: "naxa_delivery_routes",
      p_interval_ms: 250,
      p_max_wait_ms: 1500,
    });
    if (slotError || !slot) throw new Error("ROUTE_RATE_LIMIT_BUSY");
    routes = await calculerMatriceRoutiere(
      pharmacies.map(p => ({ lat: p.lat, lng: p.lng })),
      client,
    );
  } catch {
    routeDisponible = false;
  }

  const ranked = pharmacies.map((p, index) => {
    const route = routes[index] ?? null;
    return {
      id: p.id,
      nom: p.nom,
      ville: p.ville,
      quartier: p.quartier,
      adresse: p.adresse,
      lat: p.lat,
      lng: p.lng,
      de_garde: p.de_garde,
      livraison_active: p.livraison_active,
      rayon_livraison_km: p.rayon_livraison_km,
      horaires: p.horaires,
      photo_url: p.photo_url,
      photo_verified_at: p.photo_verified_at,
      stock_updated_at: p.stock_updated_at,
      distanceKm: p.distanceVolOiseauKm,
      distanceRoutiereKm: route?.distanceKm ?? null,
      dureeTrajetMinutes: route?.dureeMinutes ?? null,
      fournisseurItineraire: route?.fournisseur ?? null,
      fraisLivraisonIndicatifs: route && p.livraison_active
        ? Math.max(1000, Math.min(3000, Math.round(1000 + route.distanceKm * 200)))
        : null,
      googleMapsUrl: creerLienGoogleMaps(client, { lat: p.lat, lng: p.lng }),
    };
  }).sort((a, b) => {
    if (a.distanceRoutiereKm !== null && b.distanceRoutiereKm !== null) return a.distanceRoutiereKm - b.distanceRoutiereKm;
    if (a.distanceRoutiereKm !== null) return -1;
    if (b.distanceRoutiereKm !== null) return 1;
    return a.distanceKm - b.distanceKm;
  }).slice(0,12);

  return NextResponse.json({
    ok: true,
    pharmacies: ranked,
    routeDisponible,
    fournisseurItineraire: ranked.find(p => p.fournisseurItineraire)?.fournisseurItineraire ?? null,
    message: routeDisponible ? null : "Le calcul routier est indisponible; les pharmacies sont classées à vol d'oiseau uniquement.",
  }, { headers: { "Cache-Control": "private, no-store" } });
}

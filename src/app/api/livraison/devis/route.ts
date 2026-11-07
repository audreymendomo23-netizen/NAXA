import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import {
  calculerMatriceRoutiere,
  calculerTarifLivraison,
  determinerZoneLivraison,
  estCoordonneeCamerounaise,
  creerLienGoogleMaps,
} from "@/lib/server/delivery-routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type QuoteInput = { pharmacieId?: unknown; latitude?: unknown; longitude?: unknown };

export async function POST(request: NextRequest) {
  const auth = supabaseServer();
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: "Connectez-vous pour calculer une livraison." }, { status: 401 });
  }

  let input: QuoteInput;
  try { input = await request.json() as QuoteInput; }
  catch { return NextResponse.json({ ok: false, error: "Demande de devis invalide." }, { status: 400 }); }

  const pharmacieId = typeof input.pharmacieId === "string" ? input.pharmacieId : "";
  const client = { lat: Number(input.latitude), lng: Number(input.longitude) };
  if (!/^[0-9a-f-]{36}$/i.test(pharmacieId) || !estCoordonneeCamerounaise(client)) {
    return NextResponse.json({ ok: false, error: "Pharmacie ou position GPS invalide." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: pharmacy, error: pharmacyError } = await db.from("pharmacies")
    .select("id,nom,ville,quartier,lat,lng,actif,visible_recherche,archivee_le,livraison_active,rayon_livraison_km")
    .eq("id", pharmacieId)
    .maybeSingle();

  if (pharmacyError || !pharmacy || pharmacy.actif !== true || pharmacy.visible_recherche !== true
    || pharmacy.archivee_le !== null || pharmacy.livraison_active !== true
    || !estCoordonneeCamerounaise({ lat: Number(pharmacy.lat), lng: Number(pharmacy.lng) })) {
    return NextResponse.json({ ok: false, error: "Cette pharmacie ne propose pas actuellement une livraison géolocalisée." }, { status: 409 });
  }

  try {
    const { data: slot, error: slotError } = await db.rpc("naxa_reserve_api_rate_limit", {
      p_key: "naxa_delivery_routes",
      p_interval_ms: 250,
      p_max_wait_ms: 1500,
    });
    if (slotError || !slot) throw new Error("ROUTE_RATE_LIMIT_BUSY");

    const [route] = await calculerMatriceRoutiere(
      [{ lat: Number(pharmacy.lat), lng: Number(pharmacy.lng) }],
      client,
    );
    if (!route) {
      return NextResponse.json({ ok: false, error: "Aucun itinéraire routier praticable n'a été trouvé entre vous et cette pharmacie." }, { status: 422 });
    }
    const km = Math.round(route.distanceKm * 100) / 100;
    if (km > Number(pharmacy.rayon_livraison_km)) {
      return NextResponse.json({
        ok: false,
        error: "Cette adresse est à " + km.toLocaleString("fr-FR") + " km par la route, au-delà du rayon de "
          + pharmacy.rayon_livraison_km + " km de la pharmacie.",
      }, { status: 422 });
    }

    const { data: zonesData, error: zonesError } = await db
      .from("naxa_delivery_tariff_zones")
      .select("id,nom,zone_type,centre_latitude,centre_longitude,rayon_km,supplement_fcfa")
      .eq("actif", true);
    if (zonesError) throw new Error("DELIVERY_ZONE_RULES_UNAVAILABLE");

    const zone = determinerZoneLivraison(client, (zonesData ?? []) as Array<{
      id: string; nom: string; zone_type: "periurbaine" | "eloignee" | "difficile";
      centre_latitude: number; centre_longitude: number; rayon_km: number; supplement_fcfa: number;
    }>);
    const zoneType = zone?.zone_type ?? "standard";
    const zoneSupplement = Number(zone?.supplement_fcfa ?? 0);
    const frais = calculerTarifLivraison(km, zoneType, zoneSupplement);
    const now = new Date();
    const expire = new Date(now.getTime() + 10 * 60 * 1000);
    await db.from("naxa_delivery_quotes")
      .update({ expire_le: now.toISOString() })
      .eq("client_id", user.id)
      .eq("pharmacie_id", pharmacy.id)
      .is("consomme_le", null)
      .gt("expire_le", now.toISOString());

    const { data: quote, error: quoteError } = await db.from("naxa_delivery_quotes")
      .insert({
        client_id: user.id,
        pharmacie_id: pharmacy.id,
        latitude_client: client.lat,
        longitude_client: client.lng,
        latitude_pharmacie: Number(pharmacy.lat),
        longitude_pharmacie: Number(pharmacy.lng),
        distance_routiere_km: km,
        duree_minutes: route.dureeMinutes,
        frais_livraison: frais,
        zone_id: zone?.id ?? null,
        zone_type: zoneType,
        zone_supplement_fcfa: zoneSupplement,
        formule_version: "progressive_zones_v1",
        fournisseur_itineraire: route.fournisseur,
        calcule_le: now.toISOString(),
        expire_le: expire.toISOString(),
      })
      .select("id")
      .single();
    if (quoteError || !quote) throw new Error("DELIVERY_QUOTE_SAVE_FAILED");

    return NextResponse.json({
      ok: true,
      quoteId: quote.id,
      km,
      minutes: route.dureeMinutes,
      frais,
      fournisseur: route.fournisseur,
      calculeLe: now.toISOString(),
      expireLe: expire.toISOString(),
      googleMapsUrl: creerLienGoogleMaps(client, { lat: Number(pharmacy.lat), lng: Number(pharmacy.lng) }),
      traffic: "Non inclus dans le temps estimé.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[NAXA] Devis routier indisponible", error);
    return NextResponse.json({
      ok: false,
      error: "Le calcul routier est momentanément indisponible. Aucun tarif approximatif ne sera appliqué.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

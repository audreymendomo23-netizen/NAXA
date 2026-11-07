import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LocaliteRow = {
  id: string;
  nom: string;
  nom_normalise: string;
  type_localite: string;
  latitude: number;
  longitude: number;
  region: string | null;
  departement: string | null;
  arrondissement: string | null;
  commune: string | null;
  qualite: string;
  source_code: string;
};

type NominatimResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: { country_code?: string; city?: string; town?: string; village?: string; municipality?: string };
};

function normaliserNom(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, " ").trim();
}

function inCameroon(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= 1.5 && lat <= 13.2
    && lng >= 8.2 && lng <= 16.5;
}

function candidate(row: LocaliteRow) {
  return {
    id: row.id,
    label: row.nom,
    type: row.type_localite,
    region: row.region,
    departement: row.departement,
    arrondissement: row.arrondissement,
    commune: row.commune,
    lat: Number(row.latitude),
    lng: Number(row.longitude),
    precision: row.qualite,
    source: row.source_code,
  };
}

async function waitForGlobalGeocoderSlot(): Promise<void> {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("naxa_reserve_api_rate_limit", {
    p_key: "nominatim_public",
    p_interval_ms: 1000,
    p_max_wait_ms: 1500,
  });
  if (error || !data) throw new Error("GEOCODER_RATE_LIMIT_BUSY");
  const slot = Date.parse(String(data));
  if (!Number.isFinite(slot)) throw new Error("GEOCODER_RATE_LIMIT_INVALID");
  const delay = slot - Date.now();
  if (delay > 1500) throw new Error("GEOCODER_RATE_LIMIT_BUSY");
  if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
}

/** Recherche d'abord dans le gazetteer local; les homonymes doivent être choisis explicitement. */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
  if (query.length < 2) {
    return NextResponse.json({ error: "Saisissez une ville ou une localité." }, { status: 400 });
  }

  const normalise = normaliserNom(query);
  const db = supabaseAdmin() as any;
  try {
    const { data: exactRows, error: exactError } = await db
      .from("localites_cameroun")
      .select("id,nom,nom_normalise,type_localite,latitude,longitude,region,departement,arrondissement,commune,qualite,source_code")
      .eq("nom_normalise", normalise)
      .limit(20);
    if (exactError) throw exactError;

    const exact = ((exactRows ?? []) as LocaliteRow[])
      .filter(row => inCameroon(Number(row.latitude), Number(row.longitude)));

    if (exact.length === 1) {
      const row = exact[0];
      return NextResponse.json({
        lat: Number(row.latitude),
        lng: Number(row.longitude),
        label: row.nom,
        precision: row.qualite,
        source: row.source_code,
        localiteId: row.id,
      }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
    }
    if (exact.length > 1) {
      return NextResponse.json({
        error: "Plusieurs localités portent ce nom. Choisissez celle qui correspond à votre position.",
        candidates: exact.map(candidate),
      }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }

    const { data: partialRows, error: partialError } = await db
      .from("localites_cameroun")
      .select("id,nom,nom_normalise,type_localite,latitude,longitude,region,departement,arrondissement,commune,qualite,source_code")
      .ilike("nom_normalise", "%" + normalise + "%")
      .limit(12);
    if (partialError) throw partialError;
    const partial = ((partialRows ?? []) as LocaliteRow[])
      .filter(row => inCameroon(Number(row.latitude), Number(row.longitude)));

    if (partial.length) {
      return NextResponse.json({
        error: "Plusieurs localités correspondent à votre recherche. Choisissez le lieu exact.",
        candidates: partial.map(candidate),
      }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
  } catch (error) {
    console.error("[NAXA] Référentiel localités indisponible", error);
    // Le géocodeur de secours reste disponible lorsque le référentiel est temporairement inaccessible.
  }

  const endpoint = process.env.NAXA_GEOCODER_URL || "https://nominatim.openstreetmap.org/search";
  let url: URL;
  try {
    url = new URL(endpoint);
    if (url.protocol !== "https:") throw new Error("HTTPS requis");
  } catch {
    return NextResponse.json({ error: "Service de localisation non configuré." }, { status: 503 });
  }
  url.searchParams.set("q", query + ", Cameroun");
  url.searchParams.set("countrycodes", "cm");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("accept-language", "fr");

  try {
    await waitForGlobalGeocoderSlot();
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": "NAXA-Cameroon-LocationSearch/1.0 (naxa.home@gmail.com)" },
      signal: AbortSignal.timeout(6500),
      next: { revalidate: 86400 },
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Le service de localisation est temporairement indisponible." }, {
        status: 503, headers: { "Cache-Control": "no-store" },
      });
    }
    const results = await response.json() as NominatimResult[];
    const candidates = (Array.isArray(results) ? results : []).flatMap(result => {
      const lat = Number(result?.lat);
      const lng = Number(result?.lon);
      if (!result || !inCameroon(lat, lng)) return [];
      const label = result.address?.city || result.address?.town || result.address?.village
        || result.address?.municipality || result.display_name || query;
      return [{
        id: "nominatim:" + lat.toFixed(6) + ":" + lng.toFixed(6),
        label,
        type: "Lieu cartographié",
        region: null,
        departement: null,
        arrondissement: null,
        commune: null,
        lat,
        lng,
        precision: "community_mapped",
        source: "openstreetmap_nominatim",
      }];
    });
    if (candidates.length === 1) {
      const result = candidates[0];
      return NextResponse.json({
        lat: result.lat, lng: result.lng, label: result.label,
        precision: result.precision, source: result.source,
      }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
    }
    if (candidates.length > 1) {
      return NextResponse.json({
        error: "Plusieurs lieux correspondent. Sélectionnez la position correcte.",
        candidates,
      }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Localité camerounaise introuvable. Vérifiez l’orthographe ou utilisez le GPS." }, {
      status: 404, headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Impossible de localiser cette ville pour le moment." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}

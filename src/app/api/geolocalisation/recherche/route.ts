import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NominatimResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: { country_code?: string; city?: string; town?: string; village?: string; municipality?: string };
};

async function waitForGlobalGeocoderSlot(): Promise<void> {
  // La réservation est atomique dans Replay/Production et partagée entre toutes
  // les instances serverless; aucune instance ne peut dépasser le créneau global.
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
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
}

function inCameroon(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= 1.5 && lat <= 13.2
    && lng >= 8.2 && lng <= 16.5;
}

/** One explicit user-triggered place lookup; bulk geocoding is not permitted here. */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
  if (query.length < 2) {
    return NextResponse.json({ error: "Saisissez une ville ou une localité." }, { status: 400 });
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
  url.searchParams.set("limit", "1");
  url.searchParams.set("accept-language", "fr");

  try {
    await waitForGlobalGeocoderSlot();
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "NAXA-Cameroon-LocationSearch/1.0 (naxa.home@gmail.com)",
      },
      signal: AbortSignal.timeout(6500),
      next: { revalidate: 86400 },
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Le service de localisation est temporairement indisponible." }, {
        status: 503, headers: { "Cache-Control": "no-store" },
      });
    }
    const results = await response.json() as NominatimResult[];
    const result = Array.isArray(results) ? results[0] : null;
    const lat = Number(result?.lat);
    const lng = Number(result?.lon);
    if (!result || result.address?.country_code?.toLowerCase() !== "cm" || !inCameroon(lat, lng)) {
      return NextResponse.json({ error: "Localité camerounaise introuvable. Vérifiez l’orthographe ou utilisez le GPS." }, {
        status: 404, headers: { "Cache-Control": "no-store" },
      });
    }
    const label = [
      result.address.city || result.address.town || result.address.village || result.address.municipality,
      result.display_name,
    ].find((value) => typeof value === "string" && value.trim()) ?? query;
    return NextResponse.json({ lat, lng, label }, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch {
    return NextResponse.json({ error: "Impossible de localiser cette ville pour le moment." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}

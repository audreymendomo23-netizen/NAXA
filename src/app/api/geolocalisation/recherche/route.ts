import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NominatimResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: { country_code?: string; city?: string; town?: string; village?: string; municipality?: string };
};

let lastRequestAt = 0;
let requestQueue: Promise<void> = Promise.resolve();

async function paceGeocoder(): Promise<void> {
  const previous = requestQueue;
  let release!: () => void;
  requestQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  const delay = Math.max(0, 1100 - (Date.now() - lastRequestAt));
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  lastRequestAt = Date.now();
  release();
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
    await paceGeocoder();
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

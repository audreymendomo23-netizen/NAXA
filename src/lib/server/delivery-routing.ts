import { calculerFraisLivraison, selectionnerZoneTarifaire, type DeliveryZoneRule, type DeliveryZoneType, type DeliveryPoint } from "@/lib/delivery-pricing";

export type CoordonneesRoutage = { lat: number; lng: number };
export type ResultatRoute = {
  distanceKm: number;
  dureeMinutes: number;
  fournisseur: "google_routes" | "osrm";
};

export function estCoordonneeCamerounaise(point: CoordonneesRoutage): boolean {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && point.lat >= 1.5 && point.lat <= 13.2
    && point.lng >= 8.2 && point.lng <= 16.5;
}

export function distanceVolOiseauKm(a: CoordonneesRoutage, b: CoordonneesRoutage): number {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function parseDuree(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const seconds = Number(value.replace(/s$/, ""));
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

async function calculerAvecGoogle(
  origins: CoordonneesRoutage[],
  destination: CoordonneesRoutage,
  apiKey: string,
): Promise<Array<ResultatRoute | null>> {
  const response = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,duration,status,condition",
    },
    body: JSON.stringify({
      origins: origins.map(point => ({
        waypoint: { location: { latLng: { latitude: point.lat, longitude: point.lng } } },
      })),
      destinations: [{
        waypoint: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      }],
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      languageCode: "fr-CM",
      units: "METRIC",
    }),
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("GOOGLE_ROUTES_HTTP_" + response.status);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("GOOGLE_ROUTES_INVALID_RESPONSE");

  const byOrigin = new Map<number, ResultatRoute>();
  for (const raw of payload) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as {
      originIndex?: number;
      distanceMeters?: number;
      duration?: string;
      condition?: string;
      status?: { code?: number };
    };
    const km = typeof item.distanceMeters === "number" ? item.distanceMeters / 1000 : NaN;
    const seconds = parseDuree(item.duration);
    if (typeof item.originIndex !== "number"
      || item.status?.code !== 0
      || item.condition !== "ROUTE_EXISTS"
      || !Number.isFinite(km) || km <= 0 || !seconds) continue;
    byOrigin.set(item.originIndex, {
      distanceKm: km,
      dureeMinutes: Math.max(1, Math.round(seconds / 60)),
      fournisseur: "google_routes",
    });
  }
  return origins.map((_, index) => byOrigin.get(index) ?? null);
}

async function calculerAvecOsrm(
  origins: CoordonneesRoutage[],
  destination: CoordonneesRoutage,
): Promise<Array<ResultatRoute | null>> {
  const base = (process.env.NAXA_ROUTING_URL || "https://router.project-osrm.org").replace(/\/+$/, "");
  const points = [...origins, destination];
  const coordinates = points.map(point => point.lng + "," + point.lat).join(";");
  const url = new URL(base + "/table/v1/driving/" + coordinates);
  url.searchParams.set("sources", origins.map((_, index) => String(index)).join(";"));
  url.searchParams.set("destinations", String(origins.length));
  url.searchParams.set("annotations", "distance,duration");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("OSRM_HTTP_" + response.status);
  const payload = await response.json() as {
    code?: string;
    distances?: Array<Array<number | null>>;
    durations?: Array<Array<number | null>>;
  };
  if (payload.code !== "Ok" || !Array.isArray(payload.distances) || !Array.isArray(payload.durations)) {
    throw new Error("OSRM_INVALID_RESPONSE");
  }

  return origins.map((_, index) => {
    const distanceM = payload.distances?.[index]?.[0];
    const durationS = payload.durations?.[index]?.[0];
    if (typeof distanceM !== "number" || distanceM <= 0
      || typeof durationS !== "number" || durationS <= 0) return null;
    return {
      distanceKm: distanceM / 1000,
      dureeMinutes: Math.max(1, Math.round(durationS / 60)),
      fournisseur: "osrm" as const,
    };
  });
}

/** Calcule un trajet routier réel. Aucun tarif n'est calculé sur une distance estimée à vol d'oiseau. */
export async function calculerMatriceRoutiere(
  origins: CoordonneesRoutage[],
  destination: CoordonneesRoutage,
): Promise<Array<ResultatRoute | null>> {
  if (!origins.length || origins.length > 20
    || !estCoordonneeCamerounaise(destination)
    || origins.some(point => !estCoordonneeCamerounaise(point))) {
    throw new Error("COORDONNEES_ROUTAGE_INVALIDES");
  }

  const googleKey = process.env.GOOGLE_MAPS_ROUTES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (googleKey) {
    try {
      return await calculerAvecGoogle(origins, destination, googleKey);
    } catch (googleError) {
      try {
        return await calculerAvecOsrm(origins, destination);
      } catch (osrmError) {
        throw new Error("GOOGLE_ROUTES_AND_OSRM_UNAVAILABLE: "
          + String(googleError) + " / " + String(osrmError));
      }
    }
  }
  return calculerAvecOsrm(origins, destination);
}

export function calculerTarifLivraison(
  distanceKm: number,
  zoneType: DeliveryZoneType = "standard",
  supplementZoneFcfa = 0,
): number {
  return calculerFraisLivraison(distanceKm, zoneType, supplementZoneFcfa);
}

export function determinerZoneLivraison(
  destination: DeliveryPoint,
  zones: DeliveryZoneRule[],
): DeliveryZoneRule | null {
  return selectionnerZoneTarifaire(destination, zones);
}

export function creerLienGoogleMaps(origin: CoordonneesRoutage, destination: CoordonneesRoutage): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", origin.lat + "," + origin.lng);
  url.searchParams.set("destination", destination.lat + "," + destination.lng);
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}

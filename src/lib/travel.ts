import type { Trajet } from "./types";
import { estimerCirculation } from "./traffic";

type Coordonnees = { lat: number; lng: number };

function coordonneesValides(point: Coordonnees): boolean {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && point.lat >= -90 && point.lat <= 90
    && point.lng >= -180 && point.lng <= 180;
}

function distanceRepli(distanceVolOiseauKm: number): number {
  return Number.isFinite(distanceVolOiseauKm) && distanceVolOiseauKm > 0
    ? distanceVolOiseauKm * 1.4
    : 0;
}

/** Calcule un trajet routier; si OSRM échoue, retourne une approximation explicitement signalée. */
export async function calculerTrajet(
  de: Coordonnees,
  vers: Coordonnees,
  distanceVolOiseauKm: number,
): Promise<Trajet> {
  const facteur = estimerCirculation().facteur;
  const repli = (): Trajet => {
    const km = distanceRepli(distanceVolOiseauKm);
    return { km, minutes: Math.max(1, Math.round((km / 20) * 60 * facteur)), estime: true };
  };

  if (!coordonneesValides(de) || !coordonneesValides(vers)) return repli();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${de.lng},${de.lat};${vers.lng},${vers.lat}?overview=false`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return repli();

    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") return repli();
    const routes = (payload as { routes?: unknown }).routes;
    if (!Array.isArray(routes) || !routes.length || !routes[0] || typeof routes[0] !== "object") return repli();

    const route = routes[0] as { distance?: unknown; duration?: unknown };
    const distanceM = route.distance;
    const durationS = route.duration;
    if (typeof distanceM !== "number" || !Number.isFinite(distanceM) || distanceM < 0
      || typeof durationS !== "number" || !Number.isFinite(durationS) || durationS < 0) return repli();

    return {
      km: distanceM / 1000,
      minutes: Math.max(1, Math.round((durationS / 60) * facteur)),
      estime: false,
    };
  } catch {
    return repli();
  } finally {
    clearTimeout(timeout);
  }
}

export function lienItineraire(de: Coordonnees, vers: Coordonnees): string {
  const route = `${de.lat},${de.lng};${vers.lat},${vers.lng}`;
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(route)}`;
}

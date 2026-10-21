export type CoordonneesGPS = { lat: number; lng: number; precisionMetres: number };

export type ErreurGPS = "indisponible" | "refusee" | "introuvable" | "timeout" | "invalide";

/** Demande une position ponctuelle au navigateur, sans suivi permanent ni stockage. */
export function obtenirPositionGPS(): Promise<CoordonneesGPS> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject("indisponible" satisfies ErreurGPS);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lng, accuracy } = coords;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)
          || lat < -90 || lat > 90 || lng < -180 || lng > 180
          || !Number.isFinite(accuracy) || accuracy < 0) {
          reject("invalide" satisfies ErreurGPS);
          return;
        }
        resolve({ lat, lng, precisionMetres: accuracy });
      },
      (error) => {
        const code: ErreurGPS = error.code === 1 ? "refusee"
          : error.code === 2 ? "introuvable"
          : error.code === 3 ? "timeout" : "indisponible";
        reject(code);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

/** Classe une position uniquement lorsque celle-ci tombe dans une zone urbaine connue. */
export function villeDepuisPosition(lat: number, lng: number): "Douala" | "Yaoundé" | "À proximité" {
  const distanceKm = (a: number, b: number, c: number, d: number) => {
    const rad = (v: number) => v * Math.PI / 180;
    const deltaLat = rad(c - a);
    const deltaLng = rad(d - b);
    const h = Math.sin(deltaLat / 2) ** 2
      + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(deltaLng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "À proximité";
  if (distanceKm(lat, lng, 4.0511, 9.7679) <= 35) return "Douala";
  if (distanceKm(lat, lng, 3.8480, 11.5021) <= 35) return "Yaoundé";
  return "À proximité";
}

export const CENTRES_VILLES = {
  Douala: { lat: 4.0511, lng: 9.7679 },
  Yaoundé: { lat: 3.8480, lng: 11.5021 },
} as const;

export const FRAIS_LIVRAISON_MIN = 1500;
export const FRAIS_LIVRAISON_MAX_STANDARD = 3500;
export const FRAIS_LIVRAISON_MAX_TECHNIQUE = 20000;
export const FRAIS_LIVRAISON_FORFAIT_KM = 2.5;
export const COMMISSION_NAXA_LIVRAISON = 500;

export type DeliveryZoneType = "standard" | "periurbaine" | "eloignee" | "difficile";

export type DeliveryZoneRule = {
  id: string;
  nom: string;
  zone_type: Exclude<DeliveryZoneType, "standard">;
  centre_latitude: number;
  centre_longitude: number;
  rayon_km: number;
  supplement_fcfa: number;
};

export type DeliveryPoint = { lat: number; lng: number };

export const SUPPLEMENTS_ZONE_PAR_DEFAUT: Record<Exclude<DeliveryZoneType, "standard">, number> = {
  periurbaine: 300,
  eloignee: 700,
  difficile: 1200,
};

const TRANCHES_KILOMETRIQUES = [
  { debut: 2.5, fin: 5, tarifParKm: 100 },
  { debut: 5, fin: 10, tarifParKm: 150 },
  { debut: 10, fin: 20, tarifParKm: 200 },
  { debut: 20, fin: 50, tarifParKm: 250 },
] as const;

function verifierDistance(distanceKm: number): void {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0 || distanceKm > 50) {
    throw new RangeError("Distance routière invalide (maximum opérationnel : 50 km)");
  }
}

/** Prix progressif avant majoration de zone et avant plafonnement ordinaire. */
export function calculerTarifProgressif(distanceKm: number): number {
  verifierDistance(distanceKm);
  let supplement = 0;
  for (const tranche of TRANCHES_KILOMETRIQUES) {
    const kilometresDansTranche = Math.max(0, Math.min(distanceKm, tranche.fin) - tranche.debut);
    supplement += kilometresDansTranche * tranche.tarifParKm;
  }
  return FRAIS_LIVRAISON_MIN + Math.round(supplement);
}

/**
 * Barème NAXA : 1 500 FCFA couvrent les 2,5 premiers km.
 * Les tranches supplémentaires deviennent progressivement plus chères.
 * Standard et périurbain restent plafonnés à 3 500 FCFA.
 * Les zones éloignées/difficiles peuvent dépasser ce plafond après leur majoration.
 */
export function calculerFraisLivraison(
  distanceKm: number,
  zoneType: DeliveryZoneType = "standard",
  supplementZoneFcfa = 0,
): number {
  if (!["standard", "periurbaine", "eloignee", "difficile"].includes(zoneType)) {
    throw new RangeError("Type de zone de livraison invalide");
  }
  if (!Number.isSafeInteger(supplementZoneFcfa) || supplementZoneFcfa < 0 || supplementZoneFcfa > 5000) {
    throw new RangeError("Majoration de zone invalide");
  }

  const montant = calculerTarifProgressif(distanceKm) + supplementZoneFcfa;
  return zoneType === "eloignee" || zoneType === "difficile"
    ? montant
    : Math.min(FRAIS_LIVRAISON_MAX_STANDARD, montant);
}

function distanceVolOiseauKm(a: DeliveryPoint, b: DeliveryPoint): number {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const PRIORITE_ZONE: Record<DeliveryZoneType, number> = {
  standard: 0,
  periurbaine: 1,
  eloignee: 2,
  difficile: 3,
};

/** Résout la zone par cercle géographique contrôlé par l'Admin. En chevauchement, la zone la plus contraignante gagne. */
export function selectionnerZoneTarifaire(
  destination: DeliveryPoint,
  zones: DeliveryZoneRule[],
): DeliveryZoneRule | null {
  const matches = zones.flatMap(zone => {
    if (![zone.centre_latitude, zone.centre_longitude, zone.rayon_km, zone.supplement_fcfa].every(Number.isFinite)
      || zone.rayon_km <= 0 || zone.supplement_fcfa < 0 || zone.supplement_fcfa > 5000) return [];
    const distance = distanceVolOiseauKm(destination, {
      lat: zone.centre_latitude,
      lng: zone.centre_longitude,
    });
    return distance <= zone.rayon_km ? [{ zone, distance }] : [];
  });

  matches.sort((a, b) =>
    PRIORITE_ZONE[b.zone.zone_type] - PRIORITE_ZONE[a.zone.zone_type]
    || b.zone.supplement_fcfa - a.zone.supplement_fcfa
    || a.zone.rayon_km - b.zone.rayon_km
    || a.distance - b.distance,
  );
  return matches[0]?.zone ?? null;
}

export function repartirFraisLivraison(frais: number) {
  if (!Number.isSafeInteger(frais)
    || frais < FRAIS_LIVRAISON_MIN
    || frais > FRAIS_LIVRAISON_MAX_TECHNIQUE) {
    throw new RangeError("Frais de livraison hors limites");
  }
  return {
    fraisClient: frais,
    commissionNaxa: COMMISSION_NAXA_LIVRAISON,
    soldeLivraison: frais - COMMISSION_NAXA_LIVRAISON,
  };
}

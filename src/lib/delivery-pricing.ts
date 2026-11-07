export const FRAIS_LIVRAISON_MIN = 1500;
export const FRAIS_LIVRAISON_MAX = 3500;
export const COMMISSION_NAXA_LIVRAISON = 500;

/** Tarification transparente : 1 500 FCFA de base + 200 FCFA/km, plafonnée à 3 500 FCFA. */
export function calculerFraisLivraison(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm > 250) {
    throw new RangeError("Distance de livraison invalide");
  }
  return Math.max(
    FRAIS_LIVRAISON_MIN,
    Math.min(FRAIS_LIVRAISON_MAX, Math.round(FRAIS_LIVRAISON_MIN + distanceKm * 200)),
  );
}

export function repartirFraisLivraison(frais: number) {
  if (!Number.isSafeInteger(frais) || frais < FRAIS_LIVRAISON_MIN || frais > FRAIS_LIVRAISON_MAX) {
    throw new RangeError("Frais de livraison hors limites");
  }
  return {
    fraisClient: frais,
    commissionNaxa: COMMISSION_NAXA_LIVRAISON,
    soldeLivraison: frais - COMMISSION_NAXA_LIVRAISON,
  };
}

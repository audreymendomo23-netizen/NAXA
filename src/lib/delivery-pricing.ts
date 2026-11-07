export const FRAIS_LIVRAISON_MIN = 1500;
export const FRAIS_LIVRAISON_MAX = 3500;
export const FRAIS_LIVRAISON_FORFAIT_KM = 2.5;
export const FRAIS_LIVRAISON_PAR_KM_SUPPLEMENTAIRE = 100;
export const COMMISSION_NAXA_LIVRAISON = 500;

/**
 * 1 500 FCFA couvrent les 2,5 premiers kilomètres.
 * Au-delà : 100 FCFA par kilomètre supplémentaire, au prorata,
 * avec un plafond total de 3 500 FCFA.
 */
export function calculerFraisLivraison(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0 || distanceKm > 250) {
    throw new RangeError("Distance routière invalide");
  }

  const supplementKm = Math.max(0, distanceKm - FRAIS_LIVRAISON_FORFAIT_KM);
  const montant = FRAIS_LIVRAISON_MIN
    + Math.round(supplementKm * FRAIS_LIVRAISON_PAR_KM_SUPPLEMENTAIRE);

  return Math.min(FRAIS_LIVRAISON_MAX, montant);
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

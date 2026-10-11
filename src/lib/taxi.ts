/**
 * Estimation indicative d'une course individuelle en taxi à Yaoundé.
 * Barème de départ NON validé sur le terrain : à calibrer avec des courses réelles.
 * N'implique aucune réservation ni garantie du prix demandé par le chauffeur.
 */
export type EstimationTaxi = { minimumFcfa: number; maximumFcfa: number; indicative: true };

function arrondirCentaines(valeur: number): number {
  return Number.isFinite(valeur) && valeur > 0 ? Math.ceil(valeur / 100) * 100 : 0;
}

export function estimerTaxiFcfa(distanceKm: number): EstimationTaxi {
  const km = Number.isFinite(distanceKm) ? Math.max(0, distanceKm) : 0;

  // Hypothèses provisoires de négociation : base + coût kilométrique.
  const minimumFcfa = arrondirCentaines(Math.max(1000, 500 + km * 250));
  const maximumFcfa = arrondirCentaines(Math.max(1500, 1000 + km * 500));

  return { minimumFcfa, maximumFcfa: Math.max(minimumFcfa, maximumFcfa), indicative: true };
}

export function formaterFcfa(n: number): string {
  const valeur = Number.isFinite(n) ? Math.round(n) : 0;
  return `${valeur.toLocaleString("fr-FR")} FCFA`;
}

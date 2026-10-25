/**
 * Aucune donnée de pharmacie, de stock, de prix ou d'avis fictifs ne doit être
 * proposée dans l'application. Les scénarios de démonstration doivent vivre
 * dans les fixtures de tests, séparées des parcours utilisateurs.
 */
export type RechercheMock = {
  id: string; nom: string; medicament: string; quantite: number; prix: number;
  distanceKm: number; quartier: string; ville: string; note: number; avis: number;
  promo?: string; livraison?: string; ouvert24h?: boolean;
};

export const RECHERCHE_CLIENT_MOCK: RechercheMock[] = [];

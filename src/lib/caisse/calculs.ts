/** Calculs purs de caisse. Les montants sont des entiers en FCFA (XAF). */
export function montantEntier(value: unknown, label = "Montant"): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new RangeError(`${label} doit être un nombre entier sûr en FCFA`);
  }
  return parsed;
}

export function totalLigne(prixUnitaire: number, quantite: number): number {
  const prix = montantEntier(prixUnitaire, "Prix unitaire");
  const qte = montantEntier(quantite, "Quantité");
  if (prix < 0) throw new RangeError("Le prix unitaire ne peut pas être négatif");
  if (qte <= 0) throw new RangeError("La quantité doit être strictement positive");
  const total = prix * qte;
  if (!Number.isSafeInteger(total)) throw new RangeError("Le total de ligne dépasse la précision sûre");
  return total;
}

export function totalPanier(montants: readonly number[]): number {
  const total = montants.reduce((sum, montant, index) => {
    const value = montantEntier(montant, `Montant de ligne ${index + 1}`);
    if (value < 0) throw new RangeError("Un montant de ligne ne peut pas être négatif");
    const next = sum + value;
    if (!Number.isSafeInteger(next)) throw new RangeError("Le total du panier dépasse la précision sûre");
    return next;
  }, 0);
  return total;
}

export function monnaieARendre(montantRecu: number, totalDu: number): number {
  const recu = montantEntier(montantRecu, "Montant reçu");
  const total = montantEntier(totalDu, "Total dû");
  if (recu < 0 || total < 0) throw new RangeError("Les montants ne peuvent pas être négatifs");
  return Math.max(recu - total, 0);
}

export function calculerEcartCaisse(totalCompte: number, totalTheorique: number): number {
  const compte = montantEntier(totalCompte, "Total compté");
  const theorique = montantEntier(totalTheorique, "Total théorique");
  if (compte < 0 || theorique < 0) throw new RangeError("Les totaux de caisse ne peuvent pas être négatifs");
  return compte - theorique;
}

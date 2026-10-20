/** Formatage partagé des montants de caisse en FCFA/XAF. */
const formatFcfa = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

export function formaterFcfa(montant: number): string {
  if (!Number.isSafeInteger(montant)) {
    throw new RangeError("Le montant FCFA doit être un nombre entier sûr");
  }
  return `${formatFcfa.format(montant)} FCFA`;
}

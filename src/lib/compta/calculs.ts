import type {
  BalanceComptable, CompteComptable, CreanceComptable, EcritureComptable,
  IndicateursComptables, LigneBalance, TrancheAnciennete,
} from "./types";

/** Convertit une valeur monétaire en entier exact FCFA, sans perte de précision. */
export function montantFcfa(value: bigint | number | string, label = "Montant"): bigint {
  if (typeof value === "bigint") {
    if (value < 0n) throw new RangeError(`${label} ne peut pas être négatif`);
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} doit être un entier sûr positif en FCFA`);
    return BigInt(value);
  }
  if (!/^\d+$/.test(value.trim())) throw new RangeError(`${label} doit être un entier positif en FCFA`);
  return BigInt(value.trim());
}

export function verifierEcritureEquilibree(ecriture: EcritureComptable): { valide: boolean; debitFcfa: bigint; creditFcfa: bigint; erreurs: string[] } {
  const erreurs: string[] = [];
  let debitFcfa = 0n;
  let creditFcfa = 0n;
  if (ecriture.lignes.length < 2) erreurs.push("Une écriture doit contenir au moins deux lignes.");
  for (const [index, ligne] of ecriture.lignes.entries()) {
    if (!ligne.compteId.trim()) erreurs.push(`Ligne ${index + 1} : compte non renseigné.`);
    if (!ligne.libelle.trim()) erreurs.push(`Ligne ${index + 1} : libellé non renseigné.`);
    const debit = montantFcfa(ligne.debitFcfa, `Débit ligne ${index + 1}`);
    const credit = montantFcfa(ligne.creditFcfa, `Crédit ligne ${index + 1}`);
    if ((debit > 0n) === (credit > 0n)) erreurs.push(`Ligne ${index + 1} : renseigner un débit ou un crédit, jamais les deux ni aucun.`);
    debitFcfa += debit;
    creditFcfa += credit;
  }
  if (debitFcfa !== creditFcfa) erreurs.push("Le total des débits est différent du total des crédits.");
  if (debitFcfa === 0n) erreurs.push("Le total de l’écriture doit être strictement positif.");
  return { valide: erreurs.length === 0, debitFcfa, creditFcfa, erreurs };
}

export function calculerBalance(ecritures: readonly EcritureComptable[], comptes: readonly CompteComptable[]): BalanceComptable {
  const parId = new Map<string, CompteComptable>();
  for (const compte of comptes) {
    if (parId.has(compte.id)) throw new Error("Identifiant de compte dupliqué dans le plan fourni.");
    parId.set(compte.id, compte);
  }
  const soldes = new Map<string, { debit: bigint; credit: bigint }>();
  for (const ecriture of ecritures) {
    const verification = verifierEcritureEquilibree(ecriture);
    if (!verification.valide) throw new Error(`Écriture ${ecriture.id} invalide : ${verification.erreurs.join(" ")}`);
    for (const ligne of ecriture.lignes) {
      const compte = parId.get(ligne.compteId);
      if (!compte || compte.statut !== "valide") throw new Error(`Compte absent ou non validé : ${ligne.compteId}`);
      const actuel = soldes.get(ligne.compteId) ?? { debit: 0n, credit: 0n };
      actuel.debit += montantFcfa(ligne.debitFcfa);
      actuel.credit += montantFcfa(ligne.creditFcfa);
      soldes.set(ligne.compteId, actuel);
    }
  }
  const lignes: LigneBalance[] = [];
  let totalDebitFcfa = 0n;
  let totalCreditFcfa = 0n;
  for (const compte of comptes) {
    const solde = soldes.get(compte.id);
    if (!solde) continue;
    const net = solde.debit - solde.credit;
    lignes.push({
      compteId: compte.id, code: compte.code, libelle: compte.libelle,
      totalDebitFcfa: solde.debit, totalCreditFcfa: solde.credit,
      soldeDebitFcfa: net > 0n ? net : 0n,
      soldeCreditFcfa: net < 0n ? -net : 0n,
    });
    totalDebitFcfa += solde.debit;
    totalCreditFcfa += solde.credit;
  }
  return { lignes, totalDebitFcfa, totalCreditFcfa, equilibree: totalDebitFcfa === totalCreditFcfa };
}

function dateUtc(value: string, label: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError(`${label} doit être une date ISO AAAA-MM-JJ`);
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) throw new RangeError(`${label} est invalide`);
  return parsed;
}

export function calculerAncienneteCreances(creances: readonly CreanceComptable[], dateReference: string): TrancheAnciennete[] {
  const reference = dateUtc(dateReference, "Date de référence");
  const defs = [
    { libelle: "Non échues", min: Number.NEGATIVE_INFINITY, max: 0 },
    { libelle: "1–30 jours", min: 1, max: 30 },
    { libelle: "31–60 jours", min: 31, max: 60 },
    { libelle: "61–90 jours", min: 61, max: 90 },
    { libelle: "Plus de 90 jours", min: 91, max: Number.POSITIVE_INFINITY },
  ];
  const resultat = defs.map(d => ({ libelle: d.libelle, montantFcfa: 0n, nombre: 0 }));
  for (const creance of creances) {
    const initial = montantFcfa(creance.montantInitialFcfa, "Montant initial");
    const regle = montantFcfa(creance.montantRegleFcfa, "Montant réglé");
    if (regle > initial) throw new RangeError(`Le règlement dépasse la créance ${creance.id}`);
    const restant = initial - regle;
    if (restant === 0n) continue;
    if (!creance.dateEcheance) throw new Error(`Échéance manquante pour la créance ${creance.id}`);
    const jours = Math.floor((reference - dateUtc(creance.dateEcheance, "Date d'échéance")) / 86_400_000);
    const index = defs.findIndex(d => jours >= d.min && jours <= d.max);
    if (index >= 0) { resultat[index].montantFcfa += restant; resultat[index].nombre += 1; }
  }
  return resultat;
}

export function calculerIndicateurs(input: {
  chiffreAffairesFcfa?: bigint | number | string | null;
  coutDesVentesFcfa?: bigint | number | string | null;
  stockMoyenFcfa?: bigint | number | string | null;
  creancesClientsFcfa?: bigint | number | string | null;
  ventesCreditFcfa?: bigint | number | string | null;
  joursPeriode?: number | null;
}): IndicateursComptables {
  const ca = input.chiffreAffairesFcfa == null ? null : montantFcfa(input.chiffreAffairesFcfa, "Chiffre d'affaires");
  const cout = input.coutDesVentesFcfa == null ? null : montantFcfa(input.coutDesVentesFcfa, "Coût des ventes");
  const stock = input.stockMoyenFcfa == null ? null : montantFcfa(input.stockMoyenFcfa, "Stock moyen");
  const creances = input.creancesClientsFcfa == null ? null : montantFcfa(input.creancesClientsFcfa, "Créances clients");
  const ventesCredit = input.ventesCreditFcfa == null ? null : montantFcfa(input.ventesCreditFcfa, "Ventes à crédit");
  const jours = input.joursPeriode ?? null;
  const marge = ca !== null && cout !== null ? ca - cout : null;
  return {
    chiffreAffairesFcfa: ca,
    coutDesVentesFcfa: cout,
    margeBruteFcfa: marge,
    tauxMargeBrute: marge !== null && ca !== null && ca > 0n ? Number(marge) / Number(ca) * 100 : null,
    tauxRotationStock: cout !== null && stock !== null && stock > 0n ? Number(cout) / Number(stock) : null,
    delaiMoyenEncaissementJours:
      creances !== null && ventesCredit !== null && jours !== null && Number.isFinite(jours) && jours > 0 && ventesCredit > 0n
        ? Number(creances) / Number(ventesCredit) * jours : null,
  };
}


export interface SectionBalance {
  section: string;
  lignes: LigneBalance[];
  totalSoldeDebitFcfa: bigint;
  totalSoldeCreditFcfa: bigint;
}

/**
 * Agrège les comptes par section explicitement renseignée dans le référentiel.
 * Les comptes sans section validée restent dans "À classer" : aucun numéro
 * SYSCOHADA ni aucune classe n'est interprété implicitement.
 */
export function regrouperBalanceParSections(
  balance: BalanceComptable,
  comptes: readonly CompteComptable[],
  sectionsValidees: ReadonlySet<string>,
): SectionBalance[] {
  const comptesParId = new Map(comptes.map(c => [c.id, c] as const));
  const groupes = new Map<string, LigneBalance[]>();
  for (const ligne of balance.lignes) {
    const compte = comptesParId.get(ligne.compteId);
    const section = compte?.sectionEtats && sectionsValidees.has(compte.sectionEtats)
      ? compte.sectionEtats
      : "À classer";
    const lignes = groupes.get(section) ?? [];
    lignes.push(ligne);
    groupes.set(section, lignes);
  }
  return [...groupes.entries()].map(([section, lignes]) => ({
    section,
    lignes,
    totalSoldeDebitFcfa: lignes.reduce((s, l) => s + l.soldeDebitFcfa, 0n),
    totalSoldeCreditFcfa: lignes.reduce((s, l) => s + l.soldeCreditFcfa, 0n),
  }));
}

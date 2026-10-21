/** Types purs du moteur Comptable. Aucun montant ou compte par défaut. */
export type StatutParametre = "a_renseigner" | "a_valider" | "valide" | "inactif";
export type StatutEvenementComptable = "a_traiter" | "pret" | "ignore";
export type SensComptable = "debit" | "credit";

export interface LigneComptable {
  compteId: string;
  libelle: string;
  debitFcfa: bigint | number | string;
  creditFcfa: bigint | number | string;
}
export interface EcritureComptable {
  id: string;
  pharmacieId: string;
  dateEcriture: string;
  journalCode: string;
  referenceSource?: string | null;
  libelle: string;
  lignes: readonly LigneComptable[];
}
export interface CompteComptable {
  id: string;
  code: string;
  libelle: string;
  statut: StatutParametre;
  /** Section renseignée et validée par le référent comptable, jamais déduite du code. */
  sectionEtats?: string | null;
}
export interface LigneBalance {
  compteId: string;
  code: string;
  libelle: string;
  totalDebitFcfa: bigint;
  totalCreditFcfa: bigint;
  soldeDebitFcfa: bigint;
  soldeCreditFcfa: bigint;
}
export interface BalanceComptable {
  lignes: LigneBalance[];
  totalDebitFcfa: bigint;
  totalCreditFcfa: bigint;
  equilibree: boolean;
}
export interface CreanceComptable {
  id: string;
  reference: string;
  debiteur: string;
  dateEcheance: string | null;
  montantInitialFcfa: bigint | number | string;
  montantRegleFcfa: bigint | number | string;
}
export interface TrancheAnciennete {
  libelle: string;
  montantFcfa: bigint;
  nombre: number;
}
export interface IndicateursComptables {
  chiffreAffairesFcfa: bigint | null;
  coutDesVentesFcfa: bigint | null;
  margeBruteFcfa: bigint | null;
  tauxMargeBrute: number | null;
  tauxRotationStock: number | null;
  delaiMoyenEncaissementJours: number | null;
}
export interface MappingEvenement {
  evenementType: string;
  sens: SensComptable;
  compteId: string | null;
  statut: StatutParametre;
  valideDu?: string | null;
  valideJusquau?: string | null;
}
export interface DecisionComptabilisation {
  statut: StatutEvenementComptable;
  motifs: string[];
  comptesResolus: Record<SensComptable, string | null>;
}

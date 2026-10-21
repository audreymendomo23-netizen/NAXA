import type { DecisionComptabilisation, MappingEvenement, SensComptable, StatutParametre } from "./types";

/**
 * Valide une date calendaire réelle au format ISO, sans normalisation implicite
 * de Date.parse (qui accepterait par exemple le 31 février).
 */
function dateIsoValide(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

/**
 * Résout les mappings configurés pour un événement. Les règles fiscales/comptables
 * ne sont pas déduites ici : une absence de mapping validé produit "à traiter".
 */
export function resoudreMappingEvenement(input: {
  evenementType: string;
  dateEvenement: string;
  mappings: readonly MappingEvenement[];
  comptesValides: ReadonlySet<string>;
  parametresRequisValides?: boolean;
}): DecisionComptabilisation {
  const motifs: string[] = [];
  const comptes: Record<SensComptable, string | null> = { debit: null, credit: null };
  const date = input.dateEvenement;
  if (!dateIsoValide(date)) {
    return { statut: "a_traiter", motifs: ["Date d’événement invalide."], comptesResolus: comptes };
  }

  // Un mapping à fenêtre temporelle invalide ne doit jamais être choisi.
  const eligibles = input.mappings.filter(m => {
    if (m.valideDu && !dateIsoValide(m.valideDu)) return false;
    if (m.valideJusquau && !dateIsoValide(m.valideJusquau)) return false;
    if (m.valideDu && m.valideJusquau && m.valideDu > m.valideJusquau) return false;
    return m.evenementType === input.evenementType &&
      m.statut === "valide" &&
      (!m.valideDu || m.valideDu <= date) &&
      (!m.valideJusquau || m.valideJusquau >= date);
  });
  for (const sens of ["debit", "credit"] as const) {
    const correspondants = eligibles.filter(m => m.sens === sens);
    if (correspondants.length !== 1) {
      motifs.push(correspondants.length === 0
        ? `Mapping ${sens} absent ou non validé.`
        : `Plusieurs mappings ${sens} valides se chevauchent.`);
      continue;
    }
    const compteId = correspondants[0].compteId;
    if (!compteId || !input.comptesValides.has(compteId)) {
      motifs.push(`Compte ${sens} absent ou non validé.`);
      continue;
    }
    comptes[sens] = compteId;
  }
  if (input.parametresRequisValides === false) motifs.push("Paramètre requis à valider.");
  return {
    statut: motifs.length === 0 ? "pret" : "a_traiter",
    motifs,
    comptesResolus: comptes,
  };
}

/** Classe une valeur en paramètre sans appliquer de taux ni de valeur implicite. */
export function statutParametreApresLecture(statut: StatutParametre | null | undefined): "valide" | "a_traiter" {
  return statut === "valide" ? "valide" : "a_traiter";
}

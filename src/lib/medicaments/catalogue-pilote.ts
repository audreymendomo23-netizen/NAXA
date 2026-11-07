export type MedicamentPilote = {
  nomFr: string;
  substanceFr: string;
  alias: string[];
};

export const MEDICAMENTS_PILOTE: MedicamentPilote[] = [
  { nomFr: "Paracétamol", substanceFr: "Paracétamol", alias: ["paracetamol", "acetaminophen"] },
  { nomFr: "Amoxicilline", substanceFr: "Amoxicilline", alias: ["amoxicillin"] },
  { nomFr: "Artéméther + luméfantrine", substanceFr: "Artéméther et luméfantrine", alias: ["artemether lumefantrine", "artemether-lumefantrine", "coartem"] },
  { nomFr: "Ibuprofène", substanceFr: "Ibuprofène", alias: ["ibuprofen"] },
  { nomFr: "Métronidazole", substanceFr: "Métronidazole", alias: ["metronidazole"] },
  { nomFr: "Cétirizine", substanceFr: "Cétirizine", alias: ["cetirizine"] },
  { nomFr: "Oméprazole", substanceFr: "Oméprazole", alias: ["omeprazole"] },
  { nomFr: "Ciprofloxacine", substanceFr: "Ciprofloxacine", alias: ["ciprofloxacin"] },
  { nomFr: "Diclofénac", substanceFr: "Diclofénac", alias: ["diclofenac"] },
  { nomFr: "Azithromycine", substanceFr: "Azithromycine", alias: ["azithromycin"] }
];

export function normaliserTerme(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function trouverMedicamentPilote(query: string): MedicamentPilote | undefined {
  // Accepter les requêtes usuelles qui ajoutent dosage ou forme au nom du médicament.
  const q = normaliserTerme(query
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|ug|g|kg|ml|l|iu|ui|meq|mmol)\b/gi, " ")
    .replace(/\b(?:comprim[eé]s?|g[eé]lules?|capsules?|tablets?|capsules?|sirop|syrup)\b/gi, " "));
  return MEDICAMENTS_PILOTE.find((item) =>
    normaliserTerme(item.nomFr) === q || item.alias.some((alias) => normaliserTerme(alias) === q)
  );
}

export function termesRecherche(query: string): string[] {
  const pilot = trouverMedicamentPilote(query);
  return [...new Set([...(pilot?.alias ?? []), query.trim()].filter(Boolean))].slice(0, 3);
}

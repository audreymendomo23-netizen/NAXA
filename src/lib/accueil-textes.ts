export type Langue = "fr" | "en";

export const textes = {
  fr: {
    menu: "Menu",
    langue: "Langue",
    ouvrirMenu: "Ouvrir le menu",
    fermerMenu: "Fermer le menu",
    espaceClient: "Espace client",
    espacePharmacie: "Espace pharmacie",
    titreLigne1: "Votre médicament,",
    titreLigne2: "à 2 minutes.",
    recherchePlaceholder: "Ex. Paracétamol 500 mg",
    chercher: "Chercher",
    scanner: "Scanner mon ordonnance",
    confidentialiteScan:
      "Votre ordonnance reste sur votre téléphone. Elle n'est jamais envoyée à NAXA.",
    lectureOrdonnance: "Lecture de l'ordonnance…",
    importImage: "Importer depuis mon téléphone",
    camera: "Utiliser la caméra",
    annuler: "Annuler",
    verifierLecture: "Vérifiez les médicaments lus",
    confianceLecture: "Fiabilité de la lecture",
    faibleConfiance:
      "La fiabilité est faible : corrigez ou supprimez les lignes erronées. Seul le pharmacien confirme le médicament.",
    ajouterLigne: "Ajouter une ligne",
    chercherStock: "Chercher en stock",
    erreurLecture:
      "La lecture a échoué. Prenez la photo bien à plat, avec de la lumière, ou tapez le nom du médicament.",
    etapes: ["Je cherche", "Je trouve", "Je compare", "Je réserve"],
    recherchesFrequentes: "Recherches fréquentes",
    pharmacienCta: "Vous êtes pharmacien ? Rejoindre NAXA",
    avertissement:
      "NAXA donne une information de disponibilité, pas un avis médical. En cas d'urgence, appelez les secours au 117 (police), 118 (pompiers) ou 119 (SAMU), ou rendez-vous à la pharmacie la plus proche.",
    presDeMoi: "Près de moi",
    localisationEnCours: "Localisation en cours…",
    positionEnregistree: "Position enregistrée",
    yaoundeDefaut: "Yaoundé par défaut",
    gardes: "Pharmacies de garde",
    builtWith: "Built with ❤️ by NAXA",
  },
  en: {
    menu: "Menu",
    langue: "Language",
    ouvrirMenu: "Open menu",
    fermerMenu: "Close menu",
    espaceClient: "Customer area",
    espacePharmacie: "Pharmacy area",
    titreLigne1: "Your medicine,",
    titreLigne2: "just 2 minutes away.",
    recherchePlaceholder: "E.g. Paracetamol 500 mg",
    chercher: "Search",
    scanner: "Scan my prescription",
    confidentialiteScan:
      "Your prescription stays on your phone. It is never sent to NAXA.",
    lectureOrdonnance: "Reading prescription…",
    importImage: "Import from my phone",
    camera: "Use camera",
    annuler: "Cancel",
    verifierLecture: "Check the detected medicines",
    confianceLecture: "Reading confidence",
    faibleConfiance:
      "Confidence is low: correct or remove inaccurate lines. Only a pharmacist can confirm the medicine.",
    ajouterLigne: "Add a line",
    chercherStock: "Search availability",
    erreurLecture:
      "Reading failed. Take a well-lit, flat photo or type the medicine name.",
    etapes: ["I search", "I find", "I compare", "I reserve"],
    recherchesFrequentes: "Frequent searches",
    pharmacienCta: "Are you a pharmacist? Join NAXA",
    avertissement:
      "NAXA provides availability information, not medical advice. In an emergency, call 117 (police), 118 (fire) or 119 (ambulance), or go to the nearest pharmacy.",
    presDeMoi: "Near me",
    localisationEnCours: "Locating…",
    positionEnregistree: "Location saved",
    yaoundeDefaut: "Yaoundé by default",
    gardes: "On-duty pharmacies",
    builtWith: "Built with ❤️ by NAXA",
  },
} satisfies Record<Langue, Record<string, string | string[]>>;

export const recherchesFrequentes = [
  { fr: "Paracétamol", en: "Paracetamol" },
  { fr: "Amoxicilline", en: "Amoxicillin" },
  { fr: "Ibuprofène", en: "Ibuprofen" },
  { fr: "Artéméther/Luméfantrine", en: "Artemether/Lumefantrine" },
  { fr: "Sels de réhydratation", en: "Oral rehydration salts" },
];

export const suggestionsMedicaments = [
  { fr: "Paracétamol", en: "Paracetamol" },
  { fr: "Paracétamol 500 mg", en: "Paracetamol 500 mg" },
  { fr: "Amoxicilline", en: "Amoxicillin" },
  { fr: "Amoxicilline 500 mg", en: "Amoxicillin 500 mg" },
  { fr: "Ibuprofène", en: "Ibuprofen" },
  { fr: "Ibuprofène 400 mg", en: "Ibuprofen 400 mg" },
  { fr: "Artéméther/Luméfantrine", en: "Artemether/Lumefantrine" },
  { fr: "Sels de réhydratation", en: "Oral rehydration salts" },
];

export function normaliserRecherche(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .trim();
}

export type AccueilProduitDemo = {
  id: string;
  nom: string;
  dosage: string;
  conditionnement: string;
  laboratoire: string;
  prix: number;
  pharmacie: string;
  distanceKm: number;
  stock: number;
  ordonnance: boolean;
  photoUrl: string | null;
};

export const ACCUEIL_PRODUITS_DEMO: AccueilProduitDemo[] = [
  {
    id: "demo-paracetamol-500",
    nom: "Paracétamol 500mg",
    dosage: "500mg",
    conditionnement: "Boîte de 16 comprimés",
    laboratoire: "CIPLA",
    prix: 1500,
    pharmacie: "Pharmacie de la Gare",
    distanceKm: 0.8,
    stock: 12,
    ordonnance: false,
    photoUrl: null,
  },
  {
    id: "demo-coartem-20-120",
    nom: "Coartem 20/120mg",
    dosage: "20/120mg",
    conditionnement: "Boîte de 24 comprimés",
    laboratoire: "Novartis",
    prix: 3200,
    pharmacie: "Pharmacie Bonapriso",
    distanceKm: 1.1,
    stock: 8,
    ordonnance: true,
    photoUrl: null,
  },
];

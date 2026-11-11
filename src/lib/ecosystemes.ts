export type EcosystemeId =
  | "pharmacie"
  | "parapharmacie"
  | "examens"
  | "prestations"
  | "bebe-maman"
  | "dispositifs";

export type Ecosysteme = {
  id: EcosystemeId;
  label: string;
  shortLabel: string;
  description: string;
  href: string;
  color: string;
  softColor: string;
  accent: string;
  symbol: string;
  tagline: string;
};

export const ECOSYSTEMES: Ecosysteme[] = [
  {
    id: "pharmacie",
    label: "Pharmacie",
    shortLabel: "Pharmacie",
    description: "Rechercher un médicament et trouver une pharmacie.",
    href: "/",
    color: "#064B2A",
    softColor: "#E8F5EC",
    accent: "#FFE23D",
    symbol: "✚",
    tagline: "Médicaments et pharmacies à proximité",
  },
  {
    id: "parapharmacie",
    label: "Parapharmacie",
    shortLabel: "Parapharmacie",
    description: "Hygiène, soins et produits de bien-être.",
    href: "/parapharmacie",
    color: "#0B7378",
    softColor: "#E5F6F5",
    accent: "#64D7CF",
    symbol: "✳",
    tagline: "Hygiène, soins et bien-être",
  },
  {
    id: "examens",
    label: "Examens médicaux",
    shortLabel: "Examens",
    description: "Consulter les examens et les centres partenaires.",
    href: "/examens",
    color: "#5B3AA6",
    softColor: "#F0EBFC",
    accent: "#C8B6FA",
    symbol: "⌕",
    tagline: "Examens et centres médicaux",
  },
  {
    id: "prestations",
    label: "Soins à domicile",
    shortLabel: "Domicile",
    description: "Trouver des prestations et des professionnels à domicile.",
    href: "/prestations",
    color: "#A83C2D",
    softColor: "#FFF0EC",
    accent: "#F5B19F",
    symbol: "⌂",
    tagline: "Des services de santé près de chez vous",
  },
  {
    id: "bebe-maman",
    label: "Maman & Bébé",
    shortLabel: "Maman & Bébé",
    description: "Un espace dédié à la maternité et à la petite enfance.",
    href: "/bebe-maman",
    color: "#A72D69",
    softColor: "#FCECF3",
    accent: "#F5B7D0",
    symbol: "♡",
    tagline: "Un espace dédié à la maman et à l’enfant",
  },
  {
    id: "dispositifs",
    label: "Dispositifs médicaux",
    shortLabel: "Dispositifs",
    description: "Gérer ses appareils et consulter son suivi connecté.",
    href: "/suivi",
    color: "#1D4ED8",
    softColor: "#EAF2FE",
    accent: "#A9C8FF",
    symbol: "⌁",
    tagline: "Vos appareils et votre suivi connecté",
  },
];

export const ECOSYSTEME_PAR_ID: Record<EcosystemeId, Ecosysteme> = Object.fromEntries(
  ECOSYSTEMES.map((item) => [item.id, item]),
) as Record<EcosystemeId, Ecosysteme>;

export const CLE_ECOSYSTEME_ACTIF = "naxa-ecosysteme-actif-v1";

export function estEcosystemeId(value: string | null | undefined): value is EcosystemeId {
  return Boolean(value && Object.prototype.hasOwnProperty.call(ECOSYSTEME_PAR_ID, value));
}

export function ecosystemeDepuisChemin(pathname: string): EcosystemeId {
  if (pathname === "/parapharmacie" || pathname.startsWith("/parapharmacie/")) return "parapharmacie";
  if (pathname === "/examens" || pathname.startsWith("/examens/")) return "examens";
  if (pathname === "/prestations" || pathname.startsWith("/prestations/")) return "prestations";
  if (pathname === "/bebe-maman" || pathname.startsWith("/bebe-maman/")) return "bebe-maman";
  if (pathname === "/suivi" || pathname.startsWith("/suivi/")) return "dispositifs";
  return "pharmacie";
}

export function lireEcosystemeSelectionne(): EcosystemeId | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CLE_ECOSYSTEME_ACTIF);
    return estEcosystemeId(value) ? value : null;
  } catch {
    return null;
  }
}

export function enregistrerEcosystemeSelectionne(id: EcosystemeId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLE_ECOSYSTEME_ACTIF, id);
  } catch {
    // Le choix reste actif dans l'URL même si le stockage local est indisponible.
  }
  document.cookie = `naxa-ecosysteme=${id}; Max-Age=31536000; Path=/; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent("naxa:ecosysteme-change", { detail: { id } }));
}

export function routeProfessionnelleEcosysteme(id: EcosystemeId): string {
  switch (id) {
    case "pharmacie": return "/pharmacie";
    case "parapharmacie":
    case "bebe-maman": return "/partenaire/catalogue";
    case "examens": return "/centre-examens";
    case "prestations": return "/partenaire/prestations";
    case "dispositifs": return "/suivi/professionnel";
  }
}

export function espaceAuthentificationEcosysteme(id: EcosystemeId): "pharmacie" | "client" {
  return id === "pharmacie" ? "pharmacie" : "client";
}

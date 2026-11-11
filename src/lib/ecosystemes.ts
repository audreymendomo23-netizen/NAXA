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
  image: string;
  imagePosition: string;
  imageAlt: string;
};

export const ECOSYSTEMES: Ecosysteme[] = [
  {
    id: "pharmacie",
    label: "Pharmacie",
    shortLabel: "Pharmacie",
    description: "Médicaments et pharmacies",
    href: "/",
    color: "#064B2A",
    softColor: "#E8F5EC",
    accent: "#FFE23D",
    symbol: "✚",
    tagline: "Médicaments et pharmacies à proximité",
    image: "/images/ecosystemes/ecosystemes.webp", imagePosition: "0% 0%", imageAlt: "Rayons d’une pharmacie moderne",
  },
  {
    id: "parapharmacie",
    label: "Parapharmacie",
    shortLabel: "Parapharmacie",
    description: "Hygiène et bien-être",
    href: "/parapharmacie",
    color: "#0B7378",
    softColor: "#E5F6F5",
    accent: "#64D7CF",
    symbol: "✳",
    tagline: "Hygiène, soins et bien-être",
    image: "/images/ecosystemes/ecosystemes.webp", imagePosition: "50% 0%", imageAlt: "Rayons de produits de parapharmacie",
  },
  {
    id: "examens",
    label: "Examens médicaux",
    shortLabel: "Examens",
    description: "Laboratoires et analyses",
    href: "/examens",
    color: "#5B3AA6",
    softColor: "#F0EBFC",
    accent: "#C8B6FA",
    symbol: "⌕",
    tagline: "Examens et centres médicaux",
    image: "/images/ecosystemes/ecosystemes.webp", imagePosition: "100% 0%", imageAlt: "Laboratoire médical et analyses",
  },
  {
    id: "prestations",
    label: "Soins à domicile",
    shortLabel: "Domicile",
    description: "Services et accompagnement",
    href: "/prestations",
    color: "#A83C2D",
    softColor: "#FFF0EC",
    accent: "#F5B19F",
    symbol: "⌂",
    tagline: "Des services de santé près de chez vous",
    image: "/images/ecosystemes/ecosystemes.webp", imagePosition: "0% 100%", imageAlt: "Professionnelle accompagnant une personne à domicile",
  },
  {
    id: "bebe-maman",
    label: "Maman & Bébé",
    shortLabel: "Maman & Bébé",
    description: "Espace dédié",
    href: "/bebe-maman",
    color: "#A72D69",
    softColor: "#FCECF3",
    accent: "#F5B7D0",
    symbol: "♡",
    tagline: "Un espace dédié à la maman et à l’enfant",
    image: "/images/ecosystemes/ecosystemes.webp", imagePosition: "50% 100%", imageAlt: "Articles de soin pour bébé et maternité",
  },
  {
    id: "dispositifs",
    label: "Dispositifs médicaux",
    shortLabel: "Dispositifs",
    description: "Équipements et matériel",
    href: "/suivi",
    color: "#1D4ED8",
    softColor: "#EAF2FE",
    accent: "#A9C8FF",
    symbol: "⌁",
    tagline: "Vos appareils et votre suivi connecté",
    image: "/images/ecosystemes/ecosystemes.webp", imagePosition: "100% 100%", imageAlt: "Ensemble d’appareils médicaux de mesure",
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
  const [pathAndQuery] = pathname.split("#", 1);
  const [pathOnly = "/", query = ""] = pathAndQuery.split("?", 2);
  const ecosystemeQuery = new URLSearchParams(query).get("ecosysteme");
  if (estEcosystemeId(ecosystemeQuery)) return ecosystemeQuery;
  if (pathOnly === "/parapharmacie" || pathOnly.startsWith("/parapharmacie/")) return "parapharmacie";
  if (pathOnly === "/examens" || pathOnly.startsWith("/examens/")) return "examens";
  if (pathOnly === "/prestations" || pathOnly.startsWith("/prestations/")) return "prestations";
  if (pathOnly === "/bebe-maman" || pathOnly.startsWith("/bebe-maman/")) return "bebe-maman";
  if (pathOnly === "/suivi" || pathOnly.startsWith("/suivi/")) return "dispositifs";
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
    case "parapharmacie": return "/partenaire/catalogue?ecosysteme=parapharmacie";
    case "bebe-maman": return "/partenaire/catalogue?ecosysteme=bebe-maman";
    case "examens": return "/centre-examens";
    case "prestations": return "/partenaire/prestations";
    case "dispositifs": return "/suivi/professionnel";
  }
}

export function espaceAuthentificationEcosysteme(id: EcosystemeId): "pharmacie" | "client" {
  return id === "pharmacie" ? "pharmacie" : "client";
}

export type NatureEcosysteme = "autonome" | "connecte";
type EcosystemeDefinition = {
  id: string; label: string; shortLabel: string; description: string; href: string;
  color: string; softColor: string; accent: string; symbol: string; tagline: string;
  image: string; imagePosition: string; imageAlt: string; nature: NatureEcosysteme;
};
const DEFINITIONS_ECOSYSTEMES = [
  { id:"pharmacie", label:"Pharmacie", shortLabel:"Pharmacie", description:"Médicaments et pharmacies", href:"/", color:"#064B2A", softColor:"#E8F5EC", accent:"#FFE23D", symbol:"✚", tagline:"Médicaments et pharmacies à proximité", image:"/images/ecosystemes/ecosystemes.webp", imagePosition:"0% 0%", imageAlt:"Rayons d’une pharmacie moderne", nature:"autonome" },
  { id:"parapharmacie", label:"Parapharmacie", shortLabel:"Parapharmacie", description:"Hygiène et bien-être", href:"/parapharmacie", color:"#0B7378", softColor:"#E5F6F5", accent:"#64D7CF", symbol:"✳", tagline:"Hygiène, soins et bien-être", image:"/images/ecosystemes/ecosystemes.webp", imagePosition:"50% 0%", imageAlt:"Rayons de produits de parapharmacie", nature:"autonome" },
  { id:"bebe-maman", label:"Bébé & Maman", shortLabel:"Bébé & Maman", description:"Espace connecté aux offres Pharmacie et Parapharmacie", href:"/bebe-maman", color:"#A84370", softColor:"#FCE8F0", accent:"#F5AFCB", symbol:"♡", tagline:"Besoins bébé et maternité, reliés aux offres existantes", image:"/images/ecosystemes/ecosystemes.webp", imagePosition:"50% 100%", imageAlt:"Articles bébé et maternité", nature:"connecte" },
  { id:"dispositifs", label:"Dispositifs connectés", shortLabel:"Dispositifs connectés", description:"Suivi connecté lié aux parcours de santé", href:"/suivi", color:"#245B88", softColor:"#E8F2FC", accent:"#9CCCF2", symbol:"◉", tagline:"Dispositifs personnels et suivi de santé connecté", image:"/images/ecosystemes/ecosystemes.webp", imagePosition:"100% 100%", imageAlt:"Dispositif médical connecté", nature:"connecte" },
  { id:"examens", label:"Examens médicaux", shortLabel:"Examens médicaux", description:"Laboratoires et analyses", href:"/examens", color:"#5B3AA6", softColor:"#F0EBFC", accent:"#C8B6FA", symbol:"⌕", tagline:"Examens et centres médicaux", image:"/images/ecosystemes/ecosystemes.webp", imagePosition:"100% 0%", imageAlt:"Laboratoire médical et analyses", nature:"autonome" },
  { id:"prestations", label:"Soins & Prestations à domicile", shortLabel:"Soins à domicile", description:"Services et accompagnement à domicile", href:"/prestations", color:"#A83C2D", softColor:"#FFF0EC", accent:"#F5B19F", symbol:"⌂", tagline:"Des soins et services près de chez vous", image:"/images/ecosystemes/ecosystemes.webp", imagePosition:"0% 100%", imageAlt:"Professionnelle accompagnant une personne à domicile", nature:"autonome" },
] as const satisfies readonly EcosystemeDefinition[];
export type EcosystemeId = (typeof DEFINITIONS_ECOSYSTEMES)[number]["id"];
export type Ecosysteme = (typeof DEFINITIONS_ECOSYSTEMES)[number];
export const ECOSYSTEMES: Ecosysteme[] = [...DEFINITIONS_ECOSYSTEMES];
export const ECOSYSTEME_PAR_ID: Record<EcosystemeId, Ecosysteme> =
  Object.fromEntries(ECOSYSTEMES.map((item) => [item.id, item])) as Record<EcosystemeId, Ecosysteme>;
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
  try { const value = window.localStorage.getItem(CLE_ECOSYSTEME_ACTIF); return estEcosystemeId(value) ? value : null; }
  catch { return null; }
}
export function enregistrerEcosystemeSelectionne(id: EcosystemeId): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(CLE_ECOSYSTEME_ACTIF, id); }
  catch { /* L'URL reste la référence si le stockage local est indisponible. */ }
  document.cookie = \`naxa-ecosysteme=\${id}; Max-Age=31536000; Path=/; SameSite=Lax\`;
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

type CommonsImageInfo = {
  url?: string;
  thumburl?: string;
  descriptionurl?: string;
  extmetadata?: Record<string, { value?: string }>;
};
type CommonsCategory = { title?: string };
type CommonsPage = { title?: string; imageinfo?: CommonsImageInfo[]; categories?: CommonsCategory[] };
type CommonsResponse = { query?: { pages?: Record<string, CommonsPage> } };

export type MedicamentPhoto = {
  url: string;
  sourceUrl: string;
  licence: string;
  attribution: string | null;
  title: string;
  kind: "boite" | "comprime";
};

export type PhotosMedicament = {
  boite: MedicamentPhoto | null;
  comprime: MedicamentPhoto | null;
};

const STOPWORDS = new Set([
  "medicine", "medicament", "médicament", "drug", "drugs", "pharmaceutical",
  "tablet", "tablets", "capsule", "capsules", "pill", "pills", "comprime",
  "comprimé", "comprimés", "gelule", "gélule", "gélules", "box", "package",
  "packaging", "boite", "boîte", "carton", "image", "photo", "oral", "tablette",
  "mg", "mcg", "ug", "ml", "g", "iu", "ui"
]);

// Substances courantes utilisées pour rejeter les photos de combinaisons
// lorsque la recherche porte sur une seule molécule.
const ACTIVE_INGREDIENT_TOKENS = new Set([
  "paracetamol", "acetaminophen", "ibuprofen", "aceclofenac", "thiocolchicoside",
  "caffeine", "cafeine", "tramadol", "codeine", "amoxicillin", "clavulanate",
  "clavulanic", "azithromycin", "cetirizine", "phenylephrine", "chlorpheniramine",
  "dextromethorphan", "guaifenesin", "ambroxol", "bromhexine", "diclofenac",
  "serratiopeptidase", "aspirin", "acetylsalicylic", "pseudoephedrine", "metformin",
  "sitagliptin", "glimepiride", "levocetirizine", "montelukast", "salbutamol",
  "ipratropium", "omeprazole", "domperidone", "ondansetron", "artesunate",
  "amodiaquine", "artemether", "lumefantrine", "sulfamethoxazole", "trimethoprim",
  "quinine", "dihydroartemisinin", "piperaquine", "losartan", "amlodipine",
  "hydrochlorothiazide", "atorvastatin", "rosuvastatin", "warfarin", "rivaroxaban"
]);

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function identityTokens(value: string): string[] {
  const cleaned = value
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|ug|g|kg|ml|l|iu|ui|meq|mmol)\b/gi, " ")
    .replace(/\b\d+\s*(?:comprim[eé]s?|capsules?|g[eé]lules?|tablets?|pills?)\b/gi, " ");
  return [...new Set(normalize(cleaned).split(/\s+/).filter((token) =>
    token.length >= 3 && !STOPWORDS.has(token) && !/^\d+$/.test(token)
  ))];
}

function plain(value: string | undefined): string {
  return (value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function kindOf(page: CommonsPage): "boite" | "comprime" | null {
  const title = normalize(page.title ?? "");
  const categories = normalize((page.categories ?? []).map((category) => category.title ?? "").join(" "));
  const text = title + " " + categories;
  const box = /\b(box|packaging|package|carton|blister|boite|emballage|outer carton|medicine box|drug box)\b/.test(text);
  const pill = /\b(pill|tablet|capsule|caplet|oral solid|compressed tablet|comprime|gelule|tablette)\b/.test(text);
  if (box && !pill) return "boite";
  if (pill && !box) return "comprime";
  if (box && pill) {
    if (/\b(box|packaging|package|carton|blister|boite|emballage)\b/.test(title)) return "boite";
    if (/\b(pill|tablet|capsule|caplet|comprime|gelule|tablette)\b/.test(title)) return "comprime";
  }
  return null;
}

function allowedCommercialLicense(info: CommonsImageInfo): { licence: string; attribution: string | null } | null {
  const metadata = info.extmetadata ?? {};
  const short = plain(metadata.LicenseShortName?.value);
  const terms = plain(metadata.UsageTerms?.value);
  const url = plain(metadata.LicenseUrl?.value);
  const allowed = /^(CC0(?:\s|$)|Public domain(?:\s|$)|CC BY(?:-SA)?(?:\s|$))/i.test(short);
  if (!allowed || /\b(?:NC|ND)\b/i.test(short + " " + terms)) return null;
  if (!url && !/^Public domain/i.test(short) && !/^CC0/i.test(short)) return null;
  const artist = plain(metadata.Artist?.value) || plain(metadata.Credit?.value);
  return { licence: [short, terms, url].filter(Boolean).join(" — "), attribution: artist || null };
}

function likelyCombinationMismatch(title: string, queryTokens: string[]): boolean {
  const titleTokens = new Set(identityTokens(title));
  const detectedIngredients = [...ACTIVE_INGREDIENT_TOKENS].filter((ingredient) => titleTokens.has(ingredient));
  if (detectedIngredients.length < 2) return false;
  const query = new Set(queryTokens);
  const queryIngredientCount = detectedIngredients.filter((ingredient) => query.has(ingredient)).length;
  // Une recherche par marque peut viser une association; on bloque seulement si
  // la requête désigne un des principes actifs mais en omet un autre du titre.
  if (queryIngredientCount === 0) return false;
  return detectedIngredients.some((ingredient) => !query.has(ingredient));
}

function searchVariants(query: string, kind: "boite" | "comprime"): string[] {
  const tokens = identityTokens(query);
  const variants = [
    query,
    tokens.join(" "),
    ...(tokens.length > 1 ? tokens.slice(0, 3) : [])
  ];
  const suffix = kind === "boite"
    ? "(box OR packaging OR carton OR blister OR package)"
    : "(tablet OR capsule OR pill OR caplet)";
  return [...new Set(variants.map((value) => value.trim()).filter(Boolean))]
    .slice(0, 3)
    .map((value) => value + " " + suffix);
}

async function searchCommons(query: string, kind: "boite" | "comprime"): Promise<MedicamentPhoto | null> {
  const required = identityTokens(query);
  if (!required.length) return null;

  const variants = searchVariants(query, kind);
  const requests = variants.map(async (variant) => {
    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: "filetype:bitmap " + variant,
      gsrnamespace: "6",
      gsrlimit: "12",
      prop: "imageinfo|categories",
      cllimit: "10",
      iiprop: "url|extmetadata",
      iiurlwidth: "640",
      format: "json"
    });
    try {
      const response = await fetch("https://commons.wikimedia.org/w/api.php?" + params.toString(), {
        headers: {
          Accept: "application/json",
          "User-Agent": "NAXA/1.0 (medicine catalogue; contact: naxa.home@gmail.com)"
        },
        signal: AbortSignal.timeout(3500),
        next: { revalidate: 86400 }
      });
      if (!response.ok) return [];
      const json = await response.json() as CommonsResponse;
      return Object.values(json.query?.pages ?? {});
    } catch {
      return [];
    }
  });

  const pageMap = new Map<string, CommonsPage>();
  for (const pages of await Promise.all(requests)) {
    for (const page of pages) if (page.title) pageMap.set(page.title, page);
  }

  const ranked = [...pageMap.values()].map((page) => {
    const info = page.imageinfo?.[0];
    const title = page.title ?? "";
    const normalizedTitle = normalize(title.replace(/^File:/i, ""));
    const titleTokens = new Set(normalizedTitle.split(/\s+/));
    const matchingCount = required.filter((token) => titleTokens.has(token)).length;
    const coverage = matchingCount / required.length;
    const detectedKind = kindOf(page);
    const exactCoreMatch = required.some((token) => titleTokens.has(token));
    const combinationMismatch = likelyCombinationMismatch(title, required);
    return { page, info, title, matchingCount, coverage, detectedKind, exactCoreMatch, combinationMismatch };
  }).filter((item) =>
    item.info?.thumburl?.startsWith("https://") &&
    item.info.url?.startsWith("https://") &&
    item.info.descriptionurl?.startsWith("https://") &&
    item.exactCoreMatch &&
    item.coverage >= 0.75 &&
    item.detectedKind === kind &&
    !item.combinationMismatch
  ).sort((a, b) =>
    b.coverage - a.coverage || b.matchingCount - a.matchingCount
  );

  for (const item of ranked) {
    const info = item.info!;
    const rights = allowedCommercialLicense(info);
    if (!rights) continue;
    return {
      url: info.thumburl!,
      sourceUrl: info.descriptionurl!,
      licence: rights.licence,
      attribution: rights.attribution,
      title: item.title.replace(/^File:/i, "").replace(/\.[a-z0-9]{2,5}$/i, ""),
      kind
    };
  }
  return null;
}

/**
 * Cherche les images de boîte et de comprimé séparément, avec plusieurs requêtes
 * de recherche pour réduire les faux négatifs. Une correspondance partielle n'est
 * acceptée que si elle reste distinctive; les associations de molécules détectées
 * sont rejetées. Les licences commerciales et l'attribution restent obligatoires.
 * RxImage n'est pas appelé (API arrêtée); les notices DailyMed/openFDA/RxNorm ne
 * sont pas considérées comme des sources d'images libres par défaut.
 */
export async function rechercherPhotosMedicament(term: string): Promise<PhotosMedicament> {
  const query = term.trim().slice(0, 80);
  if (!identityTokens(query).length) return { boite: null, comprime: null };
  const [boite, comprime] = await Promise.all([
    searchCommons(query, "boite"),
    searchCommons(query, "comprime")
  ]);
  return { boite, comprime };
}

/** Compatibilité avec les appels existants : la boîte est prioritaire. */
export async function rechercherPhotoMedicament(term: string): Promise<MedicamentPhoto | null> {
  const photos = await rechercherPhotosMedicament(term);
  return photos.boite ?? photos.comprime;
}

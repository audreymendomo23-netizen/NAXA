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
  "packaging", "boite", "boîte", "carton", "image", "photo", "oral", "tablet",
  "mg", "mcg", "ug", "ml", "g", "iu", "ui"
]);

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function identityTokens(value: string): string[] {
  const cleaned = value
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|ug|g|kg|ml|l|iu|ui|meq|mmol)\b/gi, " ")
    .replace(/\b\d+\s*(?:comprim[eé]s?|capsules?|g[eé]lules?|tablets?|pills?)\b/gi, " ");
  return normalize(cleaned).split(/\s+/).filter((token) =>
    token.length >= 3 && !STOPWORDS.has(token) && !/^\d+$/.test(token)
  );
}

function plain(value: string | undefined): string {
  return (value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function kindOf(page: CommonsPage): "boite" | "comprime" | null {
  const text = normalize([
    page.title ?? "",
    ...(page.categories ?? []).map((category) => category.title ?? "")
  ].join(" "));
  const box = /\b(box|packaging|package|carton|blister|medicine box|drug box|boite|emballage|outer carton)\b/.test(text);
  const pill = /\b(pill|tablet|capsule|caplet|oral solid|compressed tablet|comprime|gelule|tablette)\b/.test(text);
  if (box && !pill) return "boite";
  if (pill && !box) return "comprime";
  if (box && pill) {
    // Le nom du fichier prime : les catégories Commons peuvent décrire le médicament,
    // pas nécessairement l'objet représenté sur la photo.
    const title = normalize(page.title ?? "");
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
  const combined = [short, terms].filter(Boolean).join(" ");
  const allowed = /^(CC0(?:\s|$)|Public domain(?:\s|$)|CC BY(?:-SA)?(?:\s|$))/i.test(short);
  if (!allowed || /\b(?:NC|ND)\b/i.test(combined)) return null;
  if (!url && !/^Public domain/i.test(short) && !/^CC0/i.test(short)) return null;
  const artist = plain(metadata.Artist?.value) || plain(metadata.Credit?.value);
  return {
    licence: [short, terms, url].filter(Boolean).join(" — "),
    attribution: artist || null
  };
}

async function searchCommons(query: string, kind: "boite" | "comprime"): Promise<MedicamentPhoto | null> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: "filetype:bitmap " + query + (kind === "boite" ? " (box OR packaging OR carton OR blister)" : " (tablet OR capsule OR pill)"),
    gsrnamespace: "6",
    gsrlimit: "20",
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
    if (!response.ok) return null;
    const json = await response.json() as CommonsResponse;
    const pages = Object.values(json.query?.pages ?? {});
    const required = identityTokens(query);
    if (!required.length) return null;

    const ranked = pages.map((page) => {
      const info = page.imageinfo?.[0];
      const title = page.title ?? "";
      const normalizedTitle = normalize(title.replace(/^File:/i, ""));
      const titleTokens = new Set(normalizedTitle.split(/\s+/));
      const matching = required.filter((token) => titleTokens.has(token));
      const coverage = matching.length / required.length;
      const detectedKind = kindOf(page);
      return { page, info, title, coverage, detectedKind, matchingCount: matching.length };
    }).filter((item) =>
      item.info?.thumburl?.startsWith("https://") &&
      item.info.url?.startsWith("https://") &&
      item.info.descriptionurl?.startsWith("https://") &&
      item.coverage === 1 &&
      item.detectedKind === kind
    ).sort((a, b) => b.matchingCount - a.matchingCount);

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
  } catch {
    return null;
  }
}

/**
 * Recherche séparément les boîtes et les comprimés dans Wikimedia Commons.
 * Seules les images dont le titre correspond à tous les tokens distinctifs et
 * dont la licence autorise la réutilisation commerciale sont retournées.
 * RxImage n'est pas appelé : son API a été arrêtée. DailyMed/openFDA/RxNorm
 * restent des sources de référence de médicaments, mais leurs médias ne sont
 * pas réutilisés automatiquement sans preuve explicite de droits commerciaux.
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

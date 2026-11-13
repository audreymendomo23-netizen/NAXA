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
  provider: "cima_aemps" | "wikimedia_commons" | "open_products_facts" | "catalogue_local_verifie";
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
  "hydrochlorothiazide", "atorvastatin", "rosuvastatin", "warfarin", "rivaroxaban",
  "ibuprofeno", "amoxicilina", "aspirina", "diclofenaco", "omeprazol", "azitromicina",
  "metformina", "cetirizina", "loratadina", "atorvastatina", "amlodipino",
  "clavulanico", "artemeter", "lumefantrina", "dihidroartemisinina", "piperaquina",
  "amodiaquina", "sulfametoxazol", "trimetoprima"
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

const IMAGE_IDENTITY_STOPWORDS = new Set([
  "medicine", "medicament", "drug", "pharmaceutical", "box", "package", "packaging",
  "carton", "blister", "outer", "tablet", "tablets", "pill", "pills", "capsule",
  "capsules", "caplet", "comprimido", "comprimidos", "tableta", "tabletas",
  "gelule", "gelules", "capsula", "capsulas", "oral", "efg", "efervescente",
  "efervescentes", "recubierto", "recubiertos", "solution", "solucion", "suspension",
  "suspensiones", "jarabe", "polvo", "cream", "crema", "ointment", "pommade"
]);

function strictImageIdentityTokens(value: string): string[] {
  return normalize(value).split(/\s+/).filter((token) =>
    token.length > 0 &&
    !IMAGE_IDENTITY_STOPWORDS.has(token) &&
    !/^\d+(?:[.,]\d+)?(?:mg|mcg|ug|g|kg|ml|iu|ui)?$/.test(token) &&
    !/^(?:mg|mcg|ug|g|kg|ml|iu|ui)$/.test(token)
  );
}

function plain(value: string | undefined): string {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
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
  const permission = plain(metadata.Permission?.value);
  const restrictions = plain(metadata.Restrictions?.value);
  const copyright = plain(metadata.Copyrighted?.value);
  const licenceText = short + " " + terms;

  // Liste blanche stricte : une mention CC partielle ou une URL quelconque
  // ne suffit pas à établir un droit de réutilisation commerciale.
  const ccBy = /^CC BY(?:-SA)?(?: \d+(?:\.\d+)*)?$/i.test(short);
  const cc0 = /^CC0(?: \d+(?:\.\d+)*)?$/i.test(short);
  const publicDomain = /^Public domain$/i.test(short);
  if (!ccBy && !cc0 && !publicDomain) return null;
  if (/\b(?:NC|ND)\b|non[\s-]?commercial|no[\s-]?derivatives|non[\s-]?derivative/i.test(licenceText)) return null;

  if (ccBy) {
    if (!url) return null;
    try {
      const licenceUrl = new URL(url);
      if (licenceUrl.hostname !== "creativecommons.org" ||
        !/^\/licenses\/by(?:-sa)?\/\d+(?:\.\d+)*\/?$/i.test(licenceUrl.pathname)) return null;
      if (short.toLowerCase().includes("by-sa") !== licenceUrl.pathname.toLowerCase().includes("by-sa")) return null;
    } catch {
      return null;
    }
  } else if (cc0) {
    if (url) {
      try {
        const licenceUrl = new URL(url);
        if (licenceUrl.hostname !== "creativecommons.org" || !/^\/publicdomain\/zero\/\d+(?:\.\d+)*\/?$/i.test(licenceUrl.pathname)) return null;
      } catch {
        return null;
      }
    }
  } else if (url) {
    try {
      const licenceUrl = new URL(url);
      if (licenceUrl.hostname !== "creativecommons.org" || !/^\/publicdomain\/mark\/\d+(?:\.\d+)*\/?$/i.test(licenceUrl.pathname)) return null;
    } catch {
      return null;
    }
  }

  // La licence de la photographie ne libère pas automatiquement la marque,
  // le graphisme de la boîte ou la forme protégée du médicament photographié.
  const embeddedRights = permission + " " + restrictions + " " + copyright;
  if (/all rights reserved|todos los derechos reservados|still the (?:copyright|patent)|(?:copyright|patent) property of|trademark.{0,80}(?:property|protected|reserved)|(?:packaging|package|box|carton|layout|design|tablet|pill|medicine).{0,100}(?:copyright|patent|trademark|protected|property of)|(?:copyright|patent|trademark).{0,100}(?:packaging|package|box|carton|layout|design|tablet|pill|medicine)/i.test(embeddedRights)) return null;

  const artist = plain(metadata.Artist?.value) || plain(metadata.Credit?.value) || plain(metadata.Attribution?.value);
  const attributionRequired = /^(?:true|yes|1)$/i.test(plain(metadata.AttributionRequired?.value));
  if (attributionRequired && !artist) return null;
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


const CIMA_BASE = "https://cima.aemps.es/cima/rest";
// CIMA expose les URLs et la date de mise à jour des photos. Les conditions
// générales de réutilisation des données AEMPS ne suffisent pas à prouver les
// droits sur les visuels fournis par les titulaires : une licence image explicite
// et une URL de licence reconnue sont donc exigées plus bas.
const CIMA_NAME_ALIASES: Record<string, string> = {
  acetaminophen: "paracetamol",
  ibuprofen: "ibuprofeno",
  ibuprofene: "ibuprofeno",
  amoxicillin: "amoxicilina",
  amoxicilline: "amoxicilina",
  aspirin: "aspirina",
  diclofenac: "diclofenaco",
  omeprazole: "omeprazol",
  azithromycin: "azitromicina",
  azithromycine: "azitromicina",
  metformin: "metformina",
  metformine: "metformina",
  clavulanate: "clavulanico",
  clavulanic: "clavulanico",
  clavulanique: "clavulanico",
  artemether: "artemeter",
  lumefantrine: "lumefantrina",
  dihydroartemisinin: "dihidroartemisinina",
  piperaquine: "piperaquina",
  amodiaquine: "amodiaquina",
  sulfamethoxazole: "sulfametoxazol",
  trimethoprim: "trimetoprima",
  cetirizine: "cetirizina",
  loratadine: "loratadina",
  atorvastatin: "atorvastatina",
  atorvastatine: "atorvastatina",
  amlodipine: "amlodipino",
  losartan: "losartan",
  salbutamol: "salbutamol"
};

type CimaPhotoEntry = {
  tipo?: string;
  url?: string;
  fecha?: string | number;
  licence?: string;
  license?: string;
  licencia?: string;
  licenceUrl?: string;
  licenseUrl?: string;
  licenciaUrl?: string;
  auteur?: string;
  author?: string;
  attribution?: string;
};
type CimaIngredient = string | { nombre?: string; principioActivo?: string };
type CimaMedicine = {
  nregistro?: string;
  nombre?: string;
  fotos?: CimaPhotoEntry[];
  principiosActivos?: CimaIngredient[];
  labtitular?: string;
};
type CimaResponse = {
  resultados?: CimaMedicine[];
  results?: CimaMedicine[];
  data?: CimaMedicine[];
  // L'endpoint de détail /medicamento renvoie directement une fiche.
  nombre?: string;
  nregistro?: string;
  fotos?: CimaPhotoEntry[];
  principiosActivos?: CimaIngredient[];
};
type OpenProductsFactsResponse = {
  code?: string;
  status?: number;
  product?: {
    code?: string;
    product_name?: string;
    brands?: string;
    categories_tags?: string[];
    image_front_url?: string;
    images?: Record<string, { uploader?: string; uploaded_t?: string }>;
  };
};

function cimaSearchTerm(query: string): string {
  return identityTokens(query).map((token) => CIMA_NAME_ALIASES[token] ?? token).join(" ");
}

function cimaNameMatches(query: string, candidateName: string): boolean {
  const wanted = identityTokens(query).map((token) => CIMA_NAME_ALIASES[token] ?? token);
  const candidateTokens = identityTokens(candidateName);
  const actual = new Set(candidateTokens);
  if (!wanted.length || !wanted.every((token) => actual.has(token))) return false;

  // Pour un terme unique, le premier token doit être exactement le nom recherché.
  // CIMA ajoute souvent un suffixe de marque, de dosage ou de forme (ex. ASPIRINA C).
  // Les associations de principes actifs restent filtrées séparément.
  if (wanted.length !== 1) return true;
  return candidateTokens[0] === wanted[0];
}

function cimaIngredients(medicine: CimaMedicine): string {
  return (medicine.principiosActivos ?? []).map((ingredient) => {
    if (typeof ingredient === "string") return ingredient;
    return ingredient.nombre ?? ingredient.principioActivo ?? "";
  }).filter(Boolean).join(" + ");
}

function cimaPhotoUpdateDate(value: string | number | undefined): string | null {
  if (value === undefined || value === null || value === "") return null;
  const numeric = typeof value === "number" ? value : /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : Number.NaN;
  const date = Number.isFinite(numeric)
    ? new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1000)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function allowedCimaImageRights(
  photo: CimaPhotoEntry,
  medicine: CimaMedicine
): { licence: string; attribution: string | null } | null {
  const licence = (photo.licence ?? photo.license ?? photo.licencia ?? "").trim();
  const licenceUrl = (photo.licenceUrl ?? photo.licenseUrl ?? photo.licenciaUrl ?? "").trim();
  const attribution = (photo.attribution ?? photo.auteur ?? photo.author ?? "").trim();
  const updatedAt = cimaPhotoUpdateDate(photo.fecha);

  // L'ouverture des données CIMA ne prouve pas à elle seule les droits sur
  // chaque photo : les images sont fournies par les titulaires d'AMM et peuvent
  // contenir des marques ou dessins protégés. Exiger une licence explicite.
  if (!updatedAt || !licence || !licenceUrl) return null;
  if (/\b(?:NC|ND)\b|non[\s-]?commercial|no[\s-]?derivatives|sin\s+obras\s+derivadas|todos\s+los\s+derechos\s+reservados|derechos\s+reservados/i.test(licence)) return null;

  const ccBy = /^CC BY(?:-SA)?(?: \d+(?:\.\d+)*)?$/i.test(licence);
  const cc0 = /^CC0(?: \d+(?:\.\d+)*)?$/i.test(licence);
  const publicDomain = /^Public Domain$/i.test(licence);
  if (!ccBy && !cc0 && !publicDomain) return null;
  try {
    const parsed = new URL(licenceUrl);
    const validCc = /^\/licenses\/by(?:-sa)?\/\d+(?:\.\d+)*\/?$/i.test(parsed.pathname);
    const validCc0 = /^\/publicdomain\/zero\/\d+(?:\.\d+)*\/?$/i.test(parsed.pathname);
    const validPd = /^\/publicdomain\/mark\/\d+(?:\.\d+)*\/?$/i.test(parsed.pathname);
    if (parsed.hostname !== "creativecommons.org" || !(validCc || validCc0 || validPd)) return null;
    if (ccBy && licence.toLowerCase().includes("by-sa") !== parsed.pathname.toLowerCase().includes("by-sa")) return null;
    if (cc0 && !validCc0) return null;
    if (publicDomain && !validPd) return null;
    if (ccBy && !attribution && !medicine.labtitular) return null;
  } catch {
    return null;
  }

  const titular = (medicine.labtitular ?? "").trim();
  return {
    licence: [licence, licenceUrl, "photo mise à jour le " + updatedAt].join(" — "),
    attribution: [
      attribution || "AEMPS / CIMA",
      titular ? "titulaire AMM : " + titular : "",
      "photo mise à jour le " + updatedAt
    ].filter(Boolean).join(" — ")
  };
}

function safeCimaImageUrl(
  raw: string | undefined,
  registration: string,
  wantedType: "materialas" | "formafarmac"
): string | null {
  if (!raw || !registration) return null;
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    const expectedFile = registration + "_" + wantedType + ".jpg";
    if (url.protocol !== "https:"
      || url.hostname !== "cima.aemps.es"
      || parts.length !== 6
      || parts[0] !== "cima"
      || parts[1] !== "fotos"
      || !["thumbnails", "full"].includes(parts[2])
      || parts[3] !== wantedType
      || parts[4] !== registration
      || parts[5] !== expectedFile) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchCimaJson(url: string): Promise<CimaResponse | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(1500),
      next: { revalidate: 604800 }
    });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    return value && typeof value === "object" ? value as CimaResponse : null;
  } catch {
    return null;
  }
}

function cimaPhoto(
  query: string,
  medicine: CimaMedicine,
  kind: "boite" | "comprime"
): MedicamentPhoto | null {
  const name = medicine.nombre ?? "";
  if (!cimaNameMatches(query, name)) return null;
  const ingredients = cimaIngredients(medicine);
  if (likelyCombinationMismatch(name + " " + ingredients, identityTokens(query))) return null;

  const registration = (medicine.nregistro ?? "").trim();
  if (!registration) return null;
  const wantedType = kind === "boite" ? "materialas" : "formafarmac";

  // Une fiche peut contenir plusieurs photos du même type. Ne pas abandonner
  // après une première entrée sans date, avec droits restrictifs ou URL invalide.
  for (const entry of medicine.fotos ?? []) {
    if (entry.tipo?.toLowerCase() !== wantedType) continue;
    const url = safeCimaImageUrl(entry.url, registration, wantedType);
    const rights = allowedCimaImageRights(entry, medicine);
    if (!url || !rights) continue;
    return {
      url,
      sourceUrl: CIMA_BASE + "/medicamento?nregistro=" + encodeURIComponent(registration),
      licence: rights.licence,
      attribution: rights.attribution,
      title: name,
      kind,
      provider: "cima_aemps"
    };
  }
  return null;
}

/**
 * CIMA/AEMPS est une source institutionnelle gratuite officiellement classée
 * parmi les données ouvertes réutilisables sous réserve d'attribution.
 * Les photos sont récupérées directement depuis les URLs fotos de l'API.
 * Le nom doit correspondre; une DCI seule ne récupère pas arbitrairement
 * l'emballage d'une marque différente.
 */
async function searchCima(query: string): Promise<PhotosMedicament> {
  const searchTerm = cimaSearchTerm(query);
  if (!searchTerm) return { boite: null, comprime: null };

  const params = new URLSearchParams({
    nombre: searchTerm,
    comerc: "1",
    pagina: "1"
  });
  const list = await fetchCimaJson(CIMA_BASE + "/medicamentos?" + params.toString());
  const records = list?.resultados ?? list?.results ?? list?.data ?? [];
  const matching = records
    .filter((record) => typeof record.nombre === "string" && cimaNameMatches(query, record.nombre))
    .filter((record) => !likelyCombinationMismatch(record.nombre ?? "", identityTokens(query)))
    .slice(0, 4);
  if (!matching.length) return { boite: null, comprime: null };

  let firstPartial: PhotosMedicament | null = null;
  for (const record of matching) {
    const candidate = record;
    let photos = {
      boite: cimaPhoto(query, candidate, "boite"),
      comprime: cimaPhoto(query, candidate, "comprime")
    };

    // La liste peut ne contenir qu'un type de photo alors que la fiche détaillée
    // en expose d'autres. Compléter depuis le même nregistro uniquement.
    if ((!photos.boite || !photos.comprime) && candidate.nregistro) {
      const detailParams = new URLSearchParams({ nregistro: candidate.nregistro });
      const detail = await fetchCimaJson(CIMA_BASE + "/medicamento?" + detailParams.toString());
      if (detail
        && detail.nregistro === candidate.nregistro
        && typeof detail.nombre === "string"
        && cimaNameMatches(query, detail.nombre)) {
        const detailPhotos = {
          boite: cimaPhoto(query, detail as CimaMedicine, "boite"),
          comprime: cimaPhoto(query, detail as CimaMedicine, "comprime")
        };
        photos = {
          boite: photos.boite ?? detailPhotos.boite,
          comprime: photos.comprime ?? detailPhotos.comprime
        };
      }
    }

    // Les deux vues proviennent toujours de la même fiche CIMA : aucune boîte
    // et aucune forme pharmaceutique ne sont combinées entre deux marques.
    if (photos.boite && photos.comprime) return photos;
    if ((photos.boite || photos.comprime) && !firstPartial) firstPartial = photos;
  }

  return firstPartial ?? { boite: null, comprime: null };
}

/**
 * Open Products Facts n'est interrogé que lorsqu'un code-barres complet est
 * fourni. L'égalité du GTIN doit être exacte et la fiche doit être catégorisée
 * comme médicament. L'uploader et la date de dépôt sont obligatoires pour
 * conserver l'attribution CC BY-SA 4.0. Les visuels peuvent toutefois contenir
 * des éléments graphiques de tiers : leur affichage reste soumis aux droits
 * éventuels sur ces éléments, comme le précise la documentation OPF.
 */
async function searchOpenProductsFactsByBarcode(barcode: string): Promise<MedicamentPhoto | null> {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(barcode)) return null;
  const fields = "code,product_name,brands,categories_tags,image_front_url,images";
  const url = "https://world.openproductsfacts.org/api/v2/product/" + barcode + ".json?fields=" + fields;
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "NAXA/1.0 (https://naxa.cm; naxa.home@gmail.com)"
      },
      signal: AbortSignal.timeout(3500),
      next: { revalidate: 604800 }
    });
    if (!response.ok) return null;
    const json = await response.json() as OpenProductsFactsResponse;
    const product = json.product;
    if (!product || json.status !== 1 || (product?.code ?? json.code) !== barcode) return null;
    const categories = (product.categories_tags ?? []).join(" ").toLowerCase();
    if (!/\b(?:medicines?|medications?|pharmaceutical|drugs?)\b/.test(categories)) return null;
    const rawImage = product.image_front_url;
    const frontImage = product.images?.front;
    const uploader = (frontImage?.uploader ?? "").trim();
    const uploadedAt = Number(frontImage?.uploaded_t ?? 0);
    if (!rawImage || !uploader || !Number.isFinite(uploadedAt) || uploadedAt <= 0) return null;
    let image: URL;
    try {
      image = new URL(rawImage);
    } catch {
      return null;
    }
    if (image.protocol !== "https:" || !(
      image.hostname === "openproductsfacts.org" ||
      image.hostname.endsWith(".openproductsfacts.org")
    )) return null;
    return {
      url: image.toString(),
      sourceUrl: "https://world.openproductsfacts.org/product/" + barcode,
      licence: "CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/ — Open Products Facts (attribution et partage à l'identique requis).",
      attribution: uploader + " — Open Products Facts (CC BY-SA 4.0) — image ajoutée le " +
        new Date(uploadedAt * 1000).toISOString().slice(0, 10) + ".",
      title: [product.product_name, product.brands].filter(Boolean).join(" — ") || barcode,
      kind: "boite",
      provider: "open_products_facts"
    };
  } catch {
    return null;
  }
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

  // Deux variantes séquentielles par type : au plus deux requêtes Commons en parallèle
  // (boîte + comprimé), conformément aux limites et bonnes pratiques Wikimedia.
  for (const variant of searchVariants(query, kind).slice(0, 2)) {
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
    let pages: CommonsPage[] = [];
    try {
      const response = await fetch("https://commons.wikimedia.org/w/api.php?" + params.toString(), {
        headers: {
          Accept: "application/json",
          "User-Agent": "NAXA/1.0 (https://naxa.cm; naxa.home@gmail.com)"
        },
        signal: AbortSignal.timeout(4000),
        next: { revalidate: 604800 }
      });
      // Ne pas réessayer immédiatement après un 429 : le cache et les recherches
      // séquentielles évitent de relancer une rafale vers l'infrastructure Commons.
      if (!response.ok) return null;
      const json = await response.json() as CommonsResponse;
      pages = Object.values(json.query?.pages ?? {});
    } catch {
      continue;
    }

    const ranked = pages.map((page) => {
      const info = page.imageinfo?.[0];
      const title = page.title ?? "";
      const normalizedTitle = normalize(title.replace(/^File:/i, ""));
      const titleTokens = new Set(normalizedTitle.split(/\s+/));
      const matchingCount = required.filter((token) => titleTokens.has(token)).length;
      const coverage = matchingCount / required.length;
      const detectedKind = kindOf(page);
      const exactCoreMatch = required.some((token) => titleTokens.has(token));
      const singleTokenLookup = required.length === 1;
      const titleIdentityTokens = strictImageIdentityTokens(title);
      const singleTokenIdentityMismatch = singleTokenLookup &&
        (titleIdentityTokens.length !== 1 || titleIdentityTokens[0] !== required[0]);
      const combinationMismatch = likelyCombinationMismatch(title, required);
      return { info, title, matchingCount, coverage, detectedKind, exactCoreMatch, singleTokenIdentityMismatch, combinationMismatch };
    }).filter((item) =>
      item.info?.thumburl?.startsWith("https://") &&
      item.info.url?.startsWith("https://") &&
      item.info.descriptionurl?.startsWith("https://") &&
      item.exactCoreMatch &&
      item.coverage >= 0.75 &&
      item.detectedKind === kind &&
      !item.singleTokenIdentityMismatch &&
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
        kind,
        provider: "wikimedia_commons"
      };
    }
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
  if (!query) return { boite: null, comprime: null };

  // Recherche directe par GTIN dans Open Products Facts : seulement si l'identité
  // du code-barres est exacte et que la fiche indique une catégorie médicament.
  if (/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(query)) {
    // Un code-barres est un identifiant, jamais un terme textuel pour CIMA/Commons.
    const barcodePhoto = await searchOpenProductsFactsByBarcode(query);
    return { boite: barcodePhoto, comprime: null };
  }
  if (!identityTokens(query).length) return { boite: null, comprime: null };

  // CIMA est interrogé en premier pour les références et photos officielles ;
  // une photo n'est retenue que si ses droits individuels sont explicites.
  // Commons complète uniquement les vues manquantes avec licence vérifiée.
  const cima = await searchCima(query);
  if (cima.boite && cima.comprime) return cima;

  // Un seul appel Commons par médicament à la fois, afin que deux recherches
  // simultanées côté interface restent dans la limite de concurrence recommandée.
  const commonsBox = cima.boite ? null : await searchCommons(query, "boite");
  const commonsPill = cima.comprime ? null : await searchCommons(query, "comprime");
  return {
    boite: cima.boite ?? commonsBox,
    comprime: cima.comprime ?? commonsPill
  };
}

/** Compatibilité avec les appels existants : la boîte est prioritaire. */
export async function rechercherPhotoMedicament(term: string): Promise<MedicamentPhoto | null> {
  const photos = await rechercherPhotosMedicament(term);
  return photos.boite ?? photos.comprime;
}

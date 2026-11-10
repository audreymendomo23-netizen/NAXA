export type StockImportField =
  | "name" | "dci" | "dosage" | "form" | "barcode"
  | "price" | "purchaseCost" | "quantity" | "batch" | "expiry" | "location";

export type StockImportColumnMap = Partial<Record<StockImportField, string>>;
export type StockImportSourceRow = {
  sourceSheet: string;
  sourceRow: number;
  values: Record<string, unknown>;
};
export type StockImportProduct = {
  id: string;
  nom: string;
  dci?: string | null;
  dosage?: string | null;
  forme?: string | null;
  code_barre?: string | null;
  conditionnement?: string | null;
};

const ALIASES: Record<StockImportField, string[]> = {
  name: ["nom", "designation", "désignation", "produit", "libelle", "libellé", "article", "medicament", "médicament", "item", "product", "drug", "description article", "nom commercial", "specialite", "spécialité", "stock item", "intitule", "intitulé"],
  dci: ["dci", "principe actif", "substance active", "active ingredient", "ingredient", "generic name", "molecule", "molécule"],
  dosage: ["dosage", "strength", "concentration", "teneur", "force"],
  form: ["forme", "form", "forme galenique", "forme galénique", "presentation", "présentation", "galenic form"],
  barcode: ["code barre", "code-barres", "barcode", "ean", "ean13", "gtin", "cip", "cip13", "code produit", "ref produit", "reference produit", "référence produit", "sku"],
  price: ["prix", "pu", "prix vente", "prix de vente", "pvt", "pv", "pvttc", "tarif", "selling price", "retail price", "unit price", "prix public", "prix unitaire", "prix ttc"],
  purchaseCost: ["prix achat", "prix d achat", "cout achat", "cout d achat", "coût achat", "coût d achat", "pa", "pmp", "prix moyen pondere", "prix moyen pondéré", "purchase price", "purchase cost", "buy price", "cost price", "unit cost", "acquisition cost"],
  quantity: ["quantite", "quantité", "qte", "qté", "stock", "qtestock", "qty", "quantity", "on hand", "available", "disponible", "stock final", "stock actuel", "solde stock", "existence", "disponibilite", "disponibilité", "physical stock"],
  batch: ["lot", "numero lot", "numéro lot", "n lot", "batch", "batch number", "lot number", "no lot", "n° lot"],
  expiry: ["peremption", "péremption", "date peremption", "date péremption", "expiration", "expiry", "expiry date", "date expiry", "dlc", "date limite", "date expiration", "expire le"],
  location: ["emplacement", "rayon", "etagere", "étagère", "bac", "location", "shelf", "warehouse location", "zone", "magasin"],
};

export function normaliserColonneStock(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function scoreHeader(header: string, field: StockImportField): number {
  const key = normaliserColonneStock(header);
  if (!key) return 0;
  const compact = key.replace(/\s/g, "");
  let best = 0;
  for (const alias of ALIASES[field]) {
    const normalized = normaliserColonneStock(alias);
    const aliasCompact = normalized.replace(/\s/g, "");
    if (key === normalized || compact === aliasCompact) best = Math.max(best, 1);
    else if (key.startsWith(normalized + " ") || normalized.startsWith(key + " ")) best = Math.max(best, 0.82);
    else if (normalized.length >= 5 && (key.includes(normalized) || normalized.includes(key))) best = Math.max(best, 0.65);
  }
  return best;
}

export function suggererColonnesStock(headers: string[]): StockImportColumnMap {
  const mapping: StockImportColumnMap = {};
  const used = new Set<string>();
  const fields = Object.keys(ALIASES) as StockImportField[];
  for (const field of fields) {
    const ranked = headers
      .map((header) => ({ header, score: scoreHeader(header, field) }))
      .filter((item) => item.score >= 0.65 && !used.has(item.header))
      .sort((a, b) => b.score - a.score);
    if (ranked[0]) {
      mapping[field] = ranked[0].header;
      used.add(ranked[0].header);
    }
  }
  return mapping;
}

export function detecterLigneEntete(rows: unknown[][], maxScan = 30): number {
  let bestIndex = -1;
  let bestScore = 0;
  for (let index = 0; index < Math.min(rows.length, maxScan); index++) {
    const cells = (rows[index] ?? []).map((value) => String(value ?? "").trim()).filter(Boolean);
    if (cells.length < 2) continue;
    const headers = cells;
    const mapping = suggererColonnesStock(headers);
    const mapped = Object.keys(mapping).length;
    const score = mapped * 3 + Math.min(cells.length, 12) * 0.15 + (mapped >= 2 ? 2 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestScore >= 5 ? bestIndex : -1;
}

export function parserNombreStock(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return null;
  let raw = String(value ?? "").trim();
  if (!raw) return null;
  raw = raw.replace(/\u00a0/g, " ").replace(/[\sFCFA€$]/gi, "").replace(/[^0-9,.-]/g, "");
  if (!raw || !/[0-9]/.test(raw)) return null;
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".";
    const thousands = decimal === "," ? /\./g : /,/g;
    raw = raw.replace(thousands, "").replace(decimal, ".");
  } else if (comma >= 0) {
    const decimals = raw.length - comma - 1;
    raw = decimals > 0 && decimals <= 2 ? raw.replace(",", ".") : raw.replace(/,/g, "");
  } else if (dot >= 0) {
    const decimals = raw.length - dot - 1;
    const dots = raw.match(/[.]/g) ?? [];
    if (decimals === 3) raw = raw.replace(/[.]/g, "");
    else if (dots.length > 1) {
      const last = raw.lastIndexOf(".");
      raw = raw.slice(0, last).replace(/[.]/g, "") + raw.slice(last);
    }
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parserDateStock(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  let match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) return validDate(match[1], match[2], match[3]);
  match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (match) {
    const year = Number(match[3]) < 100 ? String(Number(match[3]) + 2000) : match[3];
    return validDate(year, match[2], match[1]);
  }
  return null;
}

function validDate(year: string, month: string, day: string): string | null {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (!Number.isFinite(date.getTime())
    || date.getUTCFullYear() !== Number(year)
    || date.getUTCMonth() !== Number(month) - 1
    || date.getUTCDate() !== Number(day)) return null;
  return date.toISOString().slice(0, 10);
}

export function cleProduitStock(value: unknown): string {
  return normaliserColonneStock(value)
    .replace(/\b(?:mg|mcg|ug|µg|g|ml|l|ui|iu|cp|comprime|comprim[eé]s|gelule|g[eé]lule|boite|bte)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: unknown): string[] {
  return cleProduitStock(value).split(" ").filter((token) => token.length > 1 && !/^\d+$/.test(token));
}

export function scoreRapprochementProduit(row: {
  name: string;
  dci?: string | null;
  dosage?: string | null;
  form?: string | null;
  barcode?: string | null;
}, product: StockImportProduct): number {
  const barcode = String(row.barcode ?? "").replace(/\D/g, "");
  const productBarcode = String(product.code_barre ?? "").replace(/\D/g, "");
  if (barcode.length >= 8 && productBarcode === barcode) return 1;
  const wanted = cleProduitStock([row.name, row.dci, row.dosage, row.form].filter(Boolean).join(" "));
  const options = [
    cleProduitStock([product.nom, product.dci, product.dosage, product.forme, product.conditionnement].filter(Boolean).join(" ")),
    cleProduitStock(product.nom),
    cleProduitStock(product.dci),
  ].filter(Boolean);
  if (options.includes(wanted)) return 0.99;
  const wantedTokens = new Set(tokens([row.name, row.dci].filter(Boolean).join(" ")));
  if (!wantedTokens.size) return 0;
  let best = 0;
  for (const option of options) {
    const available = new Set(tokens(option));
    const overlap = [...wantedTokens].filter((token) => available.has(token)).length;
    const coverage = overlap / wantedTokens.size;
    const precision = overlap / Math.max(1, available.size);
    best = Math.max(best, (coverage * 0.75) + (precision * 0.25));
  }
  const wantedDose = cleProduitStock(row.dosage);
  const productDose = cleProduitStock(product.dosage);
  if (wantedDose && productDose && wantedDose !== productDose) return Math.min(best, 0.55);
  return best;
}

function normaliserDosageStock(value: unknown): string {
  return normaliserColonneStock(value)
    .replace(/\s+/g, "")
    .replace(/µ|μ/g, "u")
    .replace(/mcg/g, "ug");
}

function normaliserFormeStock(value: unknown): string {
  const form = normaliserColonneStock(value);
  if (/\b(comprime|cp|tablet|tab)\b/.test(form)) return "comprime";
  if (/\b(ge?lule|capsule)\b/.test(form)) return "capsule";
  if (/\b(sirop|syrup)\b/.test(form)) return "sirop";
  if (/\b(suspension)\b/.test(form)) return "suspension";
  if (/\b(solution buvable|solution orale|oral solution)\b/.test(form)) return "solution orale";
  if (/\b(injectable|injection|ampoule)\b/.test(form)) return "injectable";
  if (/\b(creme|cream)\b/.test(form)) return "creme";
  if (/\b(pommade|ointment)\b/.test(form)) return "pommade";
  if (/\b(collyre|eye drops)\b/.test(form)) return "collyre";
  return form;
}

/**
 * Vérification indépendante d'une suggestion IA.
 * L'IA ne peut jamais contourner un identifiant incompatible, une DCI,
 * un dosage ou une forme contradictoire. La suggestion reste à valider
 * explicitement par l'utilisateur même lorsque ce contrôle passe.
 */
export function verifierCorrespondanceIA(
  row: { name: string; dci?: string | null; dosage?: string | null; form?: string | null; barcode?: string | null },
  product: StockImportProduct
): { accepted: boolean; score: number; reason: string } {
  const sourceBarcode = normaliserColonneStock(row.barcode).replace(/\s/g, "");
  const targetBarcode = normaliserColonneStock(product.code_barre).replace(/\s/g, "");
  if (sourceBarcode && targetBarcode && sourceBarcode !== targetBarcode) {
    return { accepted: false, score: 0, reason: "Code-barres incompatible." };
  }

  const sourceDci = cleProduitStock(row.dci);
  const targetDci = cleProduitStock(product.dci);
  if (sourceDci && targetDci && sourceDci !== targetDci) {
    return { accepted: false, score: 0, reason: "Principe actif (DCI) incompatible." };
  }

  const sourceDose = normaliserDosageStock(row.dosage);
  const targetDose = normaliserDosageStock(product.dosage);
  if (sourceDose && targetDose && sourceDose !== targetDose) {
    return { accepted: false, score: 0, reason: "Dosage incompatible." };
  }

  const sourceForm = normaliserFormeStock(row.form);
  const targetForm = normaliserFormeStock(product.forme);
  if (sourceForm && targetForm && sourceForm !== targetForm) {
    return { accepted: false, score: 0, reason: "Forme pharmaceutique incompatible." };
  }

  const score = scoreRapprochementProduit(row, product);
  if (score < 0.45) {
    return { accepted: false, score, reason: "Correspondance insuffisamment étayée par le moteur de vérification." };
  }

  return {
    accepted: true,
    score,
    reason: "Aucune contradiction de code-barres, DCI, dosage ou forme ; rapprochement confirmé par le moteur."
  };
}

export function convertirLignesStock(
  rows: Record<string, unknown>[],
  mapping: StockImportColumnMap,
): Array<{
  sourceRow: number;
  name: string;
  dci: string | null;
  dosage: string | null;
  form: string | null;
  barcode: string | null;
  price: number | null;
  purchaseCost: number | null;
  quantity: number | null;
  batch: string | null;
  expiry: string | null;
  location: string | null;
}> {
  return rows.map((row, index) => {
    const value = (field: StockImportField) => mapping[field] ? row[mapping[field]!] : undefined;
    return {
      sourceRow: index + 1,
      name: String(value("name") ?? "").trim(),
      dci: String(value("dci") ?? "").trim() || null,
      dosage: String(value("dosage") ?? "").trim() || null,
      form: String(value("form") ?? "").trim() || null,
      barcode: String(value("barcode") ?? "").trim() || null,
      price: parserNombreStock(value("price")),
      purchaseCost: parserNombreStock(value("purchaseCost")),
      quantity: parserNombreStock(value("quantity")),
      batch: String(value("batch") ?? "").trim() || null,
      expiry: parserDateStock(value("expiry")),
      location: String(value("location") ?? "").trim() || null,
    };
  }).filter((row) => row.name.length >= 2 || Boolean(row.barcode));
}

export function validerLigneImportStock(row: ReturnType<typeof convertirLignesStock>[number]): string[] {
  const errors: string[] = [];
  if (row.name.length < 2 && !row.barcode) errors.push("nom/code produit manquant");
  if (row.quantity === null || !Number.isSafeInteger(row.quantity) || row.quantity < 0) errors.push("quantité absente ou invalide");
  if (row.price !== null && (!Number.isSafeInteger(Math.round(row.price)) || row.price < 0)) errors.push("prix de vente invalide");
  if (row.purchaseCost !== null && (!Number.isSafeInteger(Math.round(row.purchaseCost)) || row.purchaseCost < 0)) errors.push("coût d’achat invalide");
  if (Boolean(row.batch) !== Boolean(row.expiry)) errors.push("un lot doit avoir un numéro et une date de péremption");
  if (row.batch && (row.quantity === null || row.quantity <= 0)) errors.push("quantité de lot invalide");
  return errors;
}

export const STOCK_IMPORT_ALIASES = ALIASES;

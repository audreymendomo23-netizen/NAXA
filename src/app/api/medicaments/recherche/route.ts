import { NextRequest, NextResponse } from "next/server";
import { normaliserTerme, termesRecherche, trouverMedicamentPilote } from "@/lib/medicaments/catalogue-pilote";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRecord = Record<string, unknown>;
type Candidate = { rawName: string; rxcui?: string; tty?: string };

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

function cleanName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|g|kg|ml|mL|l|iu|ui|meq|mmol)(?:\s*\/\s*\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|g|kg|ml|mL|l))?\b/gi, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*%/g, " ")
    .replace(/\s*\/\s*/g, " + ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,+-]+|[\s,+-]+$/g, "")
    .trim();
}

function cleanPublicText(value: unknown, max = 520): string | null {
  const raw = strings(value)[0];
  if (!raw) return null;
  const withoutMarkup = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const safeSentences = withoutMarkup
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !/\b(dosage|dose|mg|mcg|µg|milligram|milliliter|take\b|administer|daily|every\b|once\b|twice\b|posologie)\b/i.test(sentence))
    .map((sentence) => cleanName(sentence))
    .filter(Boolean);
  const result = safeSentences.join(" ").slice(0, max).trim();
  return result || null;
}

function formFromText(value: string): string | null {
  const forms: Array<[RegExp, string]> = [
    [/\b(tablet|tablets|comprim[eé]s?)\b/i, "Comprimé"],
    [/\b(capsule|capsules|g[eé]lule)s?\b/i, "Gélule"],
    [/\b(oral suspension|suspension buvable)\b/i, "Suspension buvable"],
    [/\b(syrup|sirop)\b/i, "Sirop"],
    [/\b(oral solution|solution buvable)\b/i, "Solution buvable"],
    [/\b(cream|cr[eè]me)\b/i, "Crème"],
    [/\b(ointment|pommade)\b/i, "Pommade"],
    [/\b(eye drops|collyre)\b/i, "Collyre"],
    [/\b(injection|injectable)\b/i, "Injectable"],
    [/\b(oral powder|powder)\b/i, "Poudre orale"]
  ];
  return forms.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}


type LocalProduct = {
  id: string;
  nom: string;
  dci: string | null;
  forme: string | null;
  synonymes: string[] | null;
  photo_url: string | null;
  photo_path: string | null;
  photo_source_url: string | null;
  photo_licence: string | null;
  photo_verifiee_le: string | null;
  description: string | null;
  indications: string | null;
  precautions: string | null;
  source_fiche: string | null;
  fiche_validee: boolean | null;
};

type LocalStock = { produit_id: string; pharmacie_id: string; quantite: number; prix: number | null };

async function localProductsFor(term: string): Promise<LocalProduct[]> {
  const sb = supabaseServer();
  const needle = term.trim().slice(0, 80);
  if (needle.length < 2) return [];
  try {
    const fields = "id,nom,dci,forme,synonymes,photo_url,photo_path,photo_source_url,photo_licence,photo_verifiee_le,description,indications,precautions,source_fiche,fiche_validee";
    const [byName, byDci, bySynonym] = await Promise.all([
      sb.from("produits").select(fields).ilike("nom", "%" + needle + "%").limit(12),
      sb.from("produits").select(fields).ilike("dci", "%" + needle + "%").limit(12),
      sb.from("produits").select(fields).contains("synonymes", [needle]).limit(12)
    ]);
    if (byName.error && byDci.error && bySynonym.error) return [];
    const unique = new Map<string, LocalProduct>();
    for (const product of [...(byName.data ?? []), ...(byDci.data ?? []), ...(bySynonym.data ?? [])] as LocalProduct[]) {
      unique.set(product.id, product);
    }
    return [...unique.values()].slice(0, 20);
  } catch {
    return [];
  }
}

async function realPartnerAvailability(productIds: string[]): Promise<{ verified: boolean; byProduct: Map<string, { pharmacies: number; quantity: number; lowestPrice: number | null }> }> {
  const result = new Map<string, { pharmacies: number; quantity: number; lowestPrice: number | null }>();
  if (!productIds.length) return { verified: false, byProduct: result };
  try {
    const sb = supabaseServer();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await sb.from("stocks")
      .select("produit_id,pharmacie_id,quantite,prix,pharmacies!inner(actif)")
      .in("produit_id", productIds)
      .gt("quantite", 0)
      .eq("pharmacies.actif", true)
      .or("date_peremption.is.null,date_peremption.gte." + today);
    if (error || !data) return { verified: false, byProduct: result };
    const grouped = new Map<string, { pharmacies: Set<string>; quantity: number; lowestPrice: number | null }>();
    for (const row of data as unknown as LocalStock[]) {
      const current = grouped.get(row.produit_id) ?? { pharmacies: new Set<string>(), quantity: 0, lowestPrice: null };
      current.pharmacies.add(row.pharmacie_id);
      current.quantity += Math.max(0, Number(row.quantite) || 0);
      const price = row.prix === null || row.prix === undefined ? Number.NaN : Number(row.prix);
      if (Number.isFinite(price) && price >= 0 && (current.lowestPrice === null || price < current.lowestPrice)) current.lowestPrice = price;
      grouped.set(row.produit_id, current);
    }
    for (const [id, stock] of grouped) {
      result.set(id, { pharmacies: stock.pharmacies.size, quantity: stock.quantity, lowestPrice: stock.lowestPrice });
    }
    return { verified: true, byProduct: result };
  } catch {
    // Une erreur de lecture ne doit jamais être interprétée comme une indisponibilité confirmée.
    return { verified: false, byProduct: result };
  }
}

async function jsonFetch(url: string): Promise<AnyRecord | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4500),
      next: { revalidate: 3600 }
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return data && typeof data === "object" ? data as AnyRecord : null;
  } catch {
    return null;
  }
}

async function rxNormSearch(term: string): Promise<Candidate[]> {
  const json = await jsonFetch("https://rxnav.nlm.nih.gov/REST/drugs.json?name=" + encodeURIComponent(term));
  const group = json?.drugGroup as AnyRecord | undefined;
  const groups = Array.isArray(group?.conceptGroup) ? group.conceptGroup as AnyRecord[] : [];
  const candidates: Candidate[] = [];
  for (const item of groups) {
    const concepts = Array.isArray(item.conceptProperties) ? item.conceptProperties as AnyRecord[] : [];
    for (const concept of concepts) {
      if (typeof concept.name !== "string") continue;
      candidates.push({
        rawName: concept.name,
        rxcui: typeof concept.rxcui === "string" ? concept.rxcui : undefined,
        tty: typeof concept.tty === "string" ? concept.tty : undefined
      });
    }
  }
  const rank = (tty?: string) => tty === "IN" || tty === "PIN" || tty === "MIN" ? 0 : tty === "BN" ? 1 : 2;
  return candidates.sort((a, b) => rank(a.tty) - rank(b.tty)).slice(0, 20);
}

async function openFdaSearch(term: string): Promise<AnyRecord[]> {
  const safe = term.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const search = 'openfda.generic_name:"' + safe + '" OR openfda.brand_name:"' + safe + '"';
  const json = await jsonFetch("https://api.fda.gov/drug/label.json?limit=10&search=" + encodeURIComponent(search));
  return Array.isArray(json?.results) ? json.results as AnyRecord[] : [];
}

async function dailyMedSearch(term: string): Promise<AnyRecord[]> {
  const json = await jsonFetch("https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?pagesize=10&page=1&drug_name=" + encodeURIComponent(term));
  return Array.isArray(json?.data) ? json.data as AnyRecord[] : [];
}

function fdaField(record: AnyRecord | undefined, field: string): string[] {
  if (!record) return [];
  const openfda = record.openfda as AnyRecord | undefined;
  return strings(openfda?.[field]);
}

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (query.length < 2) {
    return NextResponse.json({ results: [], message: "Saisissez au moins deux caractères." });
  }

  const pilot = trouverMedicamentPilote(query);
  const terms = termesRecherche(query);
  const batches = await Promise.all(terms.map(async (term) => {
    const [rx, fda, daily] = await Promise.all([rxNormSearch(term), openFdaSearch(term), dailyMedSearch(term)]);
    return { rx, fda, daily };
  }));

  const rxCandidates = batches.flatMap((batch) => batch.rx);
  const fdaRecords = batches.flatMap((batch) => batch.fda);
  const dailyRecords = batches.flatMap((batch) => batch.daily);
  const preferredFda = fdaRecords.find((record) => fdaField(record, "generic_name").length || fdaField(record, "brand_name").length);
  const genericName = fdaField(preferredFda, "generic_name")[0] ?? pilot?.substanceFr ?? query;
  const form = fdaField(preferredFda, "dosage_form")[0] ?? "";

  const uniqueCandidates = new Map<string, Candidate>();
  for (const candidate of rxCandidates) {
    const cleaned = cleanName(candidate.rawName);
    if (!cleaned) continue;
    if (pilot && pilot.alias[0].trim().split(/\s+/).length === 1 && cleaned.includes(" + ")) continue;
    const key = normaliserTerme(cleaned);
    if (!uniqueCandidates.has(key)) uniqueCandidates.set(key, { ...candidate, rawName: cleaned });
  }

  if (uniqueCandidates.size === 0) {
    for (const record of fdaRecords) {
      const brand = fdaField(record, "brand_name")[0];
      const generic = fdaField(record, "generic_name")[0];
      const name = cleanName(brand ?? generic ?? "");
      if (name && !uniqueCandidates.has(normaliserTerme(name))) uniqueCandidates.set(normaliserTerme(name), { rawName: name });
    }
  }
  if (uniqueCandidates.size === 0) {
    for (const record of dailyRecords) {
      const title = typeof record.title === "string" ? record.title : "";
      const name = cleanName(title.split("[")[0].replace(/\([^)]*\)/g, ""));
      if (name && !uniqueCandidates.has(normaliserTerme(name))) uniqueCandidates.set(normaliserTerme(name), { rawName: name });
    }
  }

  const termsFlat = terms.map((term) => normaliserTerme(term).replace(/\s/g, ""));
  const matchedDaily = dailyRecords.find((record) => {
    const title = normaliserTerme(typeof record.title === "string" ? record.title : "").replace(/\s/g, "");
    return termsFlat.some((term) => term.length > 2 && title.includes(term));
  }) ?? dailyRecords[0];
  // Les images SPL de tiers ne sont pas copiées ni affichées sans licence commerciale vérifiée.

  const localProducts = await localProductsFor(query);
  const localStocks = await realPartnerAvailability(localProducts.map((product) => product.id));
  const candidates: Candidate[] = [];
  for (const product of localProducts) candidates.push({ rawName: product.nom });
  for (const candidate of uniqueCandidates.values()) {
    if (!candidates.some((existing) => normaliserTerme(existing.rawName) === normaliserTerme(candidate.rawName))) candidates.push(candidate);
  }
  const results = candidates.slice(0, 10).map((candidate, index) => {
    const raw = candidate.rawName;
    const localizedGeneric = Boolean(pilot && pilot.alias.some((alias) => normaliserTerme(raw).includes(normaliserTerme(alias))));
    const formInName = formFromText(raw);
    const name = localizedGeneric ? pilot!.nomFr + (formInName ? " — " + formInName.toLowerCase() : "") : raw;
    const candidateNorm = normaliserTerme(raw);
    const localProduct = localProducts.find((product) => {
      const productNames = [product.nom, product.dci].filter((value): value is string => Boolean(value)).map(normaliserTerme);
      return productNames.some((productName) => productName === candidateNorm || productName === normaliserTerme(name) || productName.includes(candidateNorm) || candidateNorm.includes(productName));
    }) ?? localProducts.find((product) => [product.nom, product.dci].filter(Boolean).some((value) => normaliserTerme(value as string) === normaliserTerme(query)));
    const stock = localProduct ? localStocks.byProduct.get(localProduct.id) : undefined;
    const availability = !localProduct || !localStocks.verified ? "non_verifiee" : stock?.pharmacies ? "disponible" : "indisponible";
    const brand = fdaField(preferredFda, "brand_name").find((value) => candidateNorm.includes(normaliserTerme(value))) ?? null;
    const activeIngredient = pilot?.substanceFr ?? cleanName(genericName) ?? null;
    const formValue = formFromText(form) || formInName || (form ? cleanName(form) : null);
    const candidateHasIngredient = normaliserTerme(raw).includes(normaliserTerme(genericName)) || Boolean(pilot && pilot.alias.some((alias) => normaliserTerme(raw).includes(normaliserTerme(alias))));
    const storagePhotoVerified = Boolean(localProduct?.photo_path && localProduct.photo_licence && localProduct.photo_verifiee_le);
    const storagePhotoUrl = storagePhotoVerified && localProduct?.photo_path
      ? supabaseServer().storage.from("medicaments").getPublicUrl(localProduct.photo_path).data.publicUrl
      : null;
    return {
      id: localProduct?.id ?? candidate.rxcui ?? normaliserTerme(name).replace(/\s+/g, "-") + "-" + index,
      name,
      brand: brand ? cleanName(brand) : null,
      activeIngredient: localProduct?.dci || activeIngredient || null,
      form: localProduct?.forme || (formValue ? cleanName(formValue) : null),
      definition: candidateHasIngredient ? cleanPublicText(preferredFda?.description, 460) : null,
      indications: candidateHasIngredient ? cleanPublicText(preferredFda?.indications_and_usage, 620) : null,
      imageUrl: storagePhotoUrl,
      imageSource: storagePhotoVerified ? "Photo hébergée par NAXA — licence et correspondance vérifiées" : localProduct?.photo_url ? "Photo masquée jusqu’à validation de sa provenance et de ses droits" : null,
      source: [
        candidate.rxcui ? "RxNorm" : null,
        preferredFda ? "OpenFDA" : null,
        matchedDaily ? "DailyMed" : null
      ].filter(Boolean),
      sourceUrl: candidate.rxcui
        ? "https://rxnav.nlm.nih.gov/REST/rxcui/" + candidate.rxcui + "/allProperties.json"
        : matchedDaily && typeof matchedDaily.setid === "string"
          ? "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=" + matchedDaily.setid
          : "https://open.fda.gov/apis/drug/label/",
      availability,
      partnerPharmacyCount: stock?.pharmacies ?? null,
      lowestPartnerPrice: stock?.lowestPrice ?? null,
      localProductId: localProduct?.id ?? null,
      localInformationValidated: localProduct?.fiche_validee === true,
      localInformationSource: localProduct?.source_fiche ?? null,
      cameroonRegulatoryStatus: "a_verifier",
      cameroonRegulatoryReference: "https://dpml.cm/repertoireDesAmm/index.php"
    };
  });

  return NextResponse.json({
    query,
    results,
    sourcesChecked: ["RxNorm", "OpenFDA", "DailyMed"],
    prototypeTerms: pilot ? [pilot.nomFr] : [],
    cameroonRegulatoryReference: "https://dpml.cm/repertoireDesAmm/index.php",
    notice: "Catalogue informatif. Disponibilité et prix affichés uniquement lorsqu’ils sont issus des stocks réels des pharmacies partenaires NAXA. Si le stock ne peut pas être vérifié, son statut reste non vérifié."
  }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}

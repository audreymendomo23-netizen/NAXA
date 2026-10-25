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
    // Masquer les URL malformées issues d'anciennes données importées.
    .filter((sentence) => !/https?:\s*(?:\+\s*)+/i.test(sentence))
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
type BdpmProduct = {
  cis: string; nom: string; forme: string | null; voies_administration: string | null;
  statut_amm: string | null; etat_commercialisation: string | null; date_amm: string | null;
  titulaires: string | null; substances_actives: string | null; source_nom: string;
  source_url: string; source_dataset_updated_at: string | null;
};


async function localProductsFor(term: string): Promise<LocalProduct[]> {
  const sb = supabaseServer();
  const needle = term.trim().slice(0, 80);
  if (needle.length < 2) return [];
  try {
    const fields = "id,nom,dci,forme,synonymes,photo_url,photo_path,photo_source_url,photo_licence,photo_verifiee_le,description,indications,precautions,source_fiche,fiche_validee";
    const [byName, byDci, bySynonym] = await Promise.all([
      sb.from("produits").select(fields).eq("fiche_validee", true).ilike("nom", "%" + needle + "%").limit(12),
      sb.from("produits").select(fields).eq("fiche_validee", true).ilike("dci", "%" + needle + "%").limit(12),
      sb.from("produits").select(fields).eq("fiche_validee", true).contains("synonymes", [needle]).limit(12)
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


async function bdpmProductsFor(term: string): Promise<BdpmProduct[]> {
  const needle = term.trim().replace(/[%,_()]/g, " ").replace(/\s+/g, " ").slice(0, 80);
  if (needle.length < 2) return [];
  try {
    const sb = supabaseServer();
    const fields = "cis,nom,forme,voies_administration,statut_amm,etat_commercialisation,date_amm,titulaires,substances_actives,source_nom,source_url,source_dataset_updated_at";
    const [byName, bySubstance] = await Promise.all([
      sb.from("medicaments_referentiel_sources").select(fields).ilike("nom", "%" + needle + "%").limit(8),
      sb.from("medicaments_referentiel_sources").select(fields).ilike("substances_actives", "%" + needle + "%").limit(8)
    ]);
    const unique = new Map<string, BdpmProduct>();
    for (const item of [...(byName.data ?? []), ...(bySubstance.data ?? [])] as BdpmProduct[]) unique.set(item.cis, item);
    return [...unique.values()].slice(0, 10);
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
      .eq("pharmacies.visible_recherche", true)
      .is("pharmacies.archivee_le", null)
      .not("pharmacies.nom", "ilike", "%démo%")
      .not("pharmacies.nom", "ilike", "%test%")
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
  const apiKey = process.env.OPENFDA_API_KEY;
  const url = "https://api.fda.gov/drug/label.json?limit=10" +
    (apiKey ? "&api_key=" + encodeURIComponent(apiKey) : "") +
    "&search=" + encodeURIComponent(search);
  const json = await jsonFetch(url);
  return Array.isArray(json?.results) ? json.results as AnyRecord[] : [];
}

function cleanLabelSection(value: unknown, max = 420): string | null {
  const raw = strings(value)[0];
  if (!raw) return null;
  const cleaned = raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.slice(0, max).trim() : null;
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
  const matchTerms = [...new Set([query, ...terms].map(normaliserTerme).filter((term) => term.length >= 4))];
  const preferredFda = fdaRecords.find((record) => {
    const names = [...fdaField(record, "generic_name"), ...fdaField(record, "brand_name")].map(normaliserTerme);
    return names.some((name) => matchTerms.some((term) => name === term || name.includes(term)));
  });
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
    return termsFlat.some((term) => term.length > 3 && title.includes(term));
  });
  // Les images SPL de tiers ne sont pas copiées ni affichées sans licence commerciale vérifiée.

  const [localProducts, bdpmProducts] = await Promise.all([localProductsFor(query), bdpmProductsFor(query)]);
  const localStocks = await realPartnerAvailability(localProducts.map((product) => product.id));
  const normalizedQuery = normaliserTerme(query);
  const candidates: Candidate[] = [];
  for (const product of localProducts) candidates.push({ rawName: product.nom });
  for (const candidate of uniqueCandidates.values()) {
    if (!candidates.some((existing) => normaliserTerme(existing.rawName) === normaliserTerme(candidate.rawName))) candidates.push(candidate);
  }
  const results = candidates.map((candidate, index) => {
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
    // Une lecture réussie sans ligne de stock signifie zéro pharmacie partenaire pour ce produit.
    // Une erreur de lecture ne doit jamais être présentée comme une indisponibilité confirmée.
    const availability = !localProduct || !localStocks.verified
      ? "non_verifiee"
      : stock !== undefined && stock.pharmacies > 0
        ? "disponible"
        : "indisponible";
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
      definition: cleanPublicText(localProduct?.description, 460) ?? (candidateHasIngredient ? cleanPublicText(preferredFda?.description, 460) : null),
      indications: cleanPublicText(localProduct?.indications, 620) ?? (candidateHasIngredient ? cleanPublicText(preferredFda?.indications_and_usage, 620) : null),
      safetyInformation: candidateHasIngredient ? {
        warnings: cleanLabelSection(preferredFda?.warnings, 560),
        adverseReactions: cleanLabelSection(preferredFda?.adverse_reactions, 560),
        contraindications: cleanLabelSection(preferredFda?.contraindications, 560),
        precautions: cleanLabelSection(preferredFda?.precautions, 560),
        source: preferredFda ? "openFDA — notice américaine, non spécifique à l’autorisation camerounaise" : null,
        sourceUrl: "https://open.fda.gov/apis/drug/label/",
        updatedAt: typeof preferredFda?.effective_time === "string" ? preferredFda.effective_time : null
      } : null,
      sourceDetails: [
        ...(candidate.rxcui ? [{ name: "RxNorm", role: "normalisation du nom", url: "https://rxnav.nlm.nih.gov/REST/rxcui/" + candidate.rxcui + "/allProperties.json" }] : []),
        ...(preferredFda ? [{ name: "openFDA", role: "notice et rubriques de sécurité", url: "https://open.fda.gov/apis/drug/label/", updatedAt: typeof preferredFda.effective_time === "string" ? preferredFda.effective_time : null }] : []),
        ...(matchedDaily && typeof matchedDaily.setid === "string" ? [{ name: "DailyMed", role: "notice structurée SPL", url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=" + matchedDaily.setid }] : []),
        ...(localProduct?.source_fiche ? [{ name: localProduct.source_fiche.toLowerCase().includes("bdpm") ? "BDPM / catalogue local" : "Catalogue local NAXA", role: localProduct.fiche_validee ? "fiche locale validée" : "fiche locale non validée", url: "https://base-donnees-publique.medicaments.gouv.fr/telechargement" }] : []),
        { name: "DPML Cameroun", role: "référence à consulter pour vérifier l’autorisation locale", url: "https://dpml.cm/repertoireDesAmm/index.php" }
      ],
      imageUrl: storagePhotoUrl,
      imageSource: storagePhotoUrl ? "Photo hébergée par NAXA — licence et correspondance vérifiées" : localProduct?.photo_url ? "Photo masquée jusqu’à validation de sa provenance et de ses droits" : null,
      imageSourceUrl: localProduct?.photo_source_url ?? null,
      imageLicense: localProduct?.photo_licence ?? null,
      imageAttribution: null,
      imageTitle: null,
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
      partnerPharmacyCount: localProduct && localStocks.verified ? (stock?.pharmacies ?? 0) : null,
      lowestPartnerPrice: stock?.lowestPrice ?? null,
      localProductId: localProduct?.id ?? null,
      localInformationValidated: localProduct?.fiche_validee === true,
      localInformationSource: localProduct?.source_fiche ?? null,
      cameroonRegulatoryStatus: "a_verifier",
      cameroonRegulatoryReference: "https://dpml.cm/repertoireDesAmm/index.php"
    };
  });

  const mergedResults = results.map((item) => {
    const match = bdpmProducts.find((bdpm) =>
      normaliserTerme(bdpm.nom) === normaliserTerme(item.name) ||
      (bdpm.substances_actives && item.activeIngredient && normaliserTerme(bdpm.substances_actives).includes(normaliserTerme(item.activeIngredient)))
    );
    if (!match) return item;
    const bdpmSource = {
      name: match.source_nom || "BDPM",
      role: "référentiel français importé dans NAXA; ne confirme pas l’autorisation au Cameroun",
      url: match.source_url || "https://base-donnees-publique.medicaments.gouv.fr/telechargement",
      updatedAt: match.source_dataset_updated_at
    };
    return {
      ...item,
      source: [...new Set([...item.source, match.source_nom || "BDPM"])],
      sourceDetails: [...item.sourceDetails, bdpmSource]
    };
  });
  const existingNames = new Set(mergedResults.map((item) => normaliserTerme(item.name)));
  const bdpmResults = bdpmProducts
    .filter((item) => !existingNames.has(normaliserTerme(item.nom)))
    .slice(0, Math.max(0, 10 - mergedResults.length))
    .map((item) => ({
      id: "bdpm-" + item.cis,
      name: item.nom,
      brand: null,
      activeIngredient: item.substances_actives,
      form: item.forme,
      definition: null,
      indications: null,
      safetyInformation: null,
      sourceDetails: [
        { name: item.source_nom || "BDPM", role: "référentiel français importé dans NAXA", url: item.source_url || "https://base-donnees-publique.medicaments.gouv.fr/telechargement", updatedAt: item.source_dataset_updated_at },
        { name: "DPML Cameroun", role: "à consulter pour vérifier l’autorisation au Cameroun", url: "https://dpml.cm/repertoireDesAmm/index.php" }
      ],
      imageUrl: null,
      imageSource: null,
      imageSourceUrl: null,
      imageLicense: null,
      imageAttribution: null,
      imageTitle: null,
      source: [item.source_nom || "BDPM"],
      sourceUrl: item.source_url || "https://base-donnees-publique.medicaments.gouv.fr/telechargement",
      availability: "non_verifiee" as const,
      partnerPharmacyCount: null,
      lowestPartnerPrice: null,
      localProductId: null,
      localInformationValidated: false,
      localInformationSource: item.source_nom,
      cameroonRegulatoryStatus: "a_verifier" as const,
      cameroonRegulatoryReference: "https://dpml.cm/repertoireDesAmm/index.php",
      bdpmCis: item.cis,
      bdpmCommercialStatus: item.etat_commercialisation,
      bdpmAmmaStatus: item.statut_amm,
      bdpmRoutes: item.voies_administration,
      bdpmHolder: item.titulaires,
      bdpmSourceDatasetUpdatedAt: item.source_dataset_updated_at
    }));
  // Les sources externes peuvent décrire plusieurs fois le même médicament et
  // le rapprochement local peut attribuer un même produit à plusieurs variantes.
  // Dédupliquer avant la limite et conserver la première fiche, mieux priorisée.
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const combinedResults = [...mergedResults, ...bdpmResults].filter((item) => {
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const name = normaliserTerme(typeof item.name === "string" ? item.name : "");
    if ((id && seenIds.has(id)) || (name && seenNames.has(name))) return false;
    if (id) seenIds.add(id);
    if (name) seenNames.add(name);
    return true;
  }).slice(0, 10);

  return NextResponse.json({
    query,
    results: combinedResults,
    sourcesChecked: ["RxNorm", "openFDA", "DailyMed", ...(bdpmProducts.length || localProducts.some((product) => (product.source_fiche ?? "").toLowerCase().includes("bdpm")) ? ["BDPM (référentiel français importé)"] : [])],
    prototypeTerms: pilot ? [pilot.nomFr] : [],
    cameroonRegulatoryReference: "https://dpml.cm/repertoireDesAmm/index.php",
    notice: "Catalogue informatif. Disponibilité et prix affichés uniquement lorsqu’ils sont issus des stocks réels des pharmacies partenaires NAXA. Si le stock ne peut pas être vérifié, son statut reste non vérifié."
  }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}

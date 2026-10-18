import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RecordObject = Record<string, unknown>;
type DictionaryResult = {
  terme: string;
  definition: string;
  source: string;
  sourceUrl: string;
  type: string | null;
  notice: string;
  imageUrl: string | null;
  imageAlt: string | null;
  imageSourceUrl: string | null;
  imageSource: string | null;
};

async function fetchJson(url: string): Promise<RecordObject | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6500),
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return data && typeof data === "object" ? data as RecordObject : null;
  } catch {
    return null;
  }
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

function cleanText(value: unknown, max = 1800): string {
  if (typeof value !== "string") return "";
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

async function searchDrugImage(term: string, matchedNames: string[]): Promise<{imageUrl:string; imageAlt:string; imageSourceUrl:string; imageSource:string} | null> {
  // DailyMed label media can provide a genuine product/packaging image. Only use
  // it when the label name matches the searched term to avoid misleading photos.
  const search = await fetchJson("https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?pagesize=8&page=1&drug_name=" + encodeURIComponent(term));
  const data = Array.isArray(search?.data) ? search.data as RecordObject[] : [];
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const wanted = normalize(term);
  const candidate = data.find((item) => {
    const title = typeof item.title === "string" ? normalize(item.title) : "";
    return title.includes(wanted) || matchedNames.some((name) => title.includes(normalize(name)));
  });
  const setId = typeof candidate?.setid === "string" ? candidate.setid : null;
  if (!setId) return null;
  const media = await fetchJson("https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/" + encodeURIComponent(setId) + "/media.json");
  const mediaData = media?.data as RecordObject | undefined;
  const mediaItems = Array.isArray(mediaData?.media) ? mediaData.media as RecordObject[] : [];
  const imageItem = mediaItems.find((item) => typeof item.url === "string" && /^https:\/\/dailymed\.nlm\.nih\.gov\//i.test(item.url) && typeof item.mime_type === "string" && item.mime_type.startsWith("image/"));
  if (typeof imageItem?.url !== "string") return null;
  const title = typeof candidate?.title === "string" ? candidate.title : term;
  return {
    imageUrl: imageItem.url,
    imageAlt: "Illustration du conditionnement indiqué sur une notice DailyMed : " + title,
    imageSourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=" + encodeURIComponent(setId),
    imageSource: "DailyMed — notice américaine",
  };
}

async function searchDrugLabel(term: string): Promise<DictionaryResult | null> {
  const safe = term.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const query = '(openfda.generic_name:"' + safe + '" OR openfda.brand_name:"' + safe + '")';
  const json = await fetchJson("https://api.fda.gov/drug/label.json?limit=5&search=" + encodeURIComponent(query));
  const records = Array.isArray(json?.results) ? json.results as RecordObject[] : [];
  const normalized = term.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const record = records.find((item) => {
    const openfda = item.openfda as RecordObject | undefined;
    return [...strings(openfda?.generic_name), ...strings(openfda?.brand_name)].some((name) =>
      name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(normalized)
    );
  }) ?? records[0];
  if (!record) return null;
  const openfda = record.openfda as RecordObject | undefined;
  const name = strings(openfda?.brand_name)[0] ?? strings(openfda?.generic_name)[0] ?? term;
  const description = cleanText(strings(record.description)[0]);
  const indications = cleanText(strings(record.indications_and_usage)[0]);
  const definition = description || indications;
  if (!definition) return null;
  const matchedNames = [...strings(openfda?.generic_name), ...strings(openfda?.brand_name)];
  const image = await searchDrugImage(term, matchedNames);
  return {
    terme: name,
    definition,
    source: "OpenFDA — notice officielle américaine",
    sourceUrl: "https://open.fda.gov/apis/drug/label/",
    type: "Médicament",
    notice: "L’étiquetage provient des États-Unis et peut différer de la notice autorisée au Cameroun. Vérifiez toujours la notice du produit exact auprès d’un pharmacien. Cette fiche ne donne aucun conseil de dosage.",
    imageUrl: image?.imageUrl ?? null,
    imageAlt: image?.imageAlt ?? null,
    imageSourceUrl: image?.imageSourceUrl ?? null,
    imageSource: image?.imageSource ?? null,
  };
}

async function searchEncyclopedia(term: string): Promise<DictionaryResult | null> {
  const search = await fetchJson("https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=" + encodeURIComponent(term) + "&srlimit=5&format=json&origin=*");
  const query = search?.query as RecordObject | undefined;
  const entries = Array.isArray(query?.search) ? query.search as RecordObject[] : [];
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const wanted = normalize(term);
  const entry = entries.find((item) => typeof item.title === "string" && normalize(item.title) === wanted) ?? entries[0];
  if (typeof entry?.title !== "string") return null;
  const page = await fetchJson("https://fr.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(entry.title.replace(/ /g, "_")));
  const definition = cleanText(page?.extract);
  if (!definition) return null;
  const title = typeof page?.title === "string" ? page.title : entry.title;
  const thumbnail = page?.thumbnail as RecordObject | undefined;
  const thumbnailSource = typeof thumbnail?.source === "string" ? thumbnail.source : null;
  const safeImageUrl = thumbnailSource && /^https:\/\/upload\.wikimedia\.org\//i.test(thumbnailSource) ? thumbnailSource : null;
  const articleUrl = "https://fr.wikipedia.org/wiki/" + encodeURIComponent(title.replace(/ /g, "_"));
  return {
    terme: title,
    definition,
    source: "Wikipédia en français — article encyclopédique",
    sourceUrl: articleUrl,
    type: "Définition encyclopédique",
    notice: "Information générale à visée documentaire, pas un diagnostic ni une recommandation de traitement. Pour une décision médicale, consultez un professionnel de santé. Pour les médicaments, référez-vous à la notice exacte délivrée au Cameroun.",
    imageUrl: safeImageUrl,
    imageAlt: safeImageUrl ? "Illustration issue de l’article encyclopédique : " + title : null,
    imageSourceUrl: safeImageUrl ? articleUrl : null,
    imageSource: safeImageUrl ? "Wikipédia en français" : null,
  };
}

export async function GET(request: NextRequest) {
  const term = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (term.length < 2) {
    return NextResponse.json({ error: "Saisissez au moins deux caractères." }, { status: 400 });
  }

  // Prefer a medicine label when a matching label exists, then use an encyclopedia
  // entry for illnesses, molecules and other general medical terms.
  const drug = await searchDrugLabel(term);
  const result = drug ?? await searchEncyclopedia(term);
  if (!result) {
    return NextResponse.json({
      error: "Aucune définition suffisamment fiable n’a été trouvée. Essayez un autre nom ou vérifiez l’orthographe.",
    }, { status: 404 });
  }
  return NextResponse.json({ result }, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}

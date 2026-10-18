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
  return {
    terme: name,
    definition,
    source: "OpenFDA — notice officielle américaine",
    sourceUrl: "https://open.fda.gov/apis/drug/label/",
    type: "Médicament",
    notice: "L’étiquetage provient des États-Unis et peut différer de la notice autorisée au Cameroun. Vérifiez toujours la notice du produit exact auprès d’un pharmacien. Cette fiche ne donne aucun conseil de dosage.",
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
  return {
    terme: title,
    definition,
    source: "Wikipédia en français — article encyclopédique",
    sourceUrl: "https://fr.wikipedia.org/wiki/" + encodeURIComponent(title.replace(/ /g, "_")),
    type: "Définition encyclopédique",
    notice: "Information générale à visée documentaire, pas un diagnostic ni une recommandation de traitement. Pour une décision médicale, consultez un professionnel de santé. Pour les médicaments, référez-vous à la notice exacte délivrée au Cameroun.",
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

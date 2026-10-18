import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RecordObject = Record<string, unknown>;
const suggestionsMedicalesParLangue: Record<"fr" | "en", string[]> = {
  fr: [
    "paracétamol", "paludisme", "paludisme grave", "palpitations", "pansement", "pancréatite", "pancréas",
    "papillomavirus", "parkinson", "parasite", "parasitoses", "parodontite", "paralysie", "pâleur",
    "panique", "palu", "malaria", "maladie", "mal de tête", "mal de gorge", "maux de ventre", "maux de tête",
    "méningite", "migraine", "molécule", "médicament", "médecine", "mycose", "amoxicilline", "anémie",
    "asthme", "allergie", "antibiotique", "arthrite", "arthrose", "bronchite", "diabète", "diarrhée",
    "fièvre", "grippe", "hypertension", "infection", "insomnie", "tension artérielle", "toux", "ulcère", "varicelle"
  ],
  en: [
    "paracetamol", "pain", "painkiller", "pancreas", "pancreatitis", "panic attack", "paralysis", "parasite",
    "parkinson's disease", "palpitations", "papillomavirus", "malaria", "malaria parasite", "malaria symptoms",
    "malaria prevention", "malaria treatment", "malnutrition", "measles", "meningitis", "migraine", "molecule",
    "medicine", "medication", "mycosis", "amoxicillin", "anemia", "asthma", "allergy", "antibiotic", "arthritis",
    "bronchitis", "diabetes", "diarrhea", "fever", "flu", "hypertension", "infection", "insomnia", "sore throat",
    "stomach ache", "cough", "ulcer", "chickenpox"
  ],
};
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
    imageAlt: "Illustrative packaging from a DailyMed label: " + title,
    imageSourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=" + encodeURIComponent(setId),
    imageSource: "DailyMed — U.S. drug label",
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
      name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === normalized
    );
  });
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
    source: "OpenFDA — official U.S. drug label",
    sourceUrl: "https://open.fda.gov/apis/drug/label/",
    type: "Medicine",
    notice: "This label is from the United States and may differ from the leaflet authorized in Cameroon. Always verify the exact product leaflet with a pharmacist. This entry does not provide dosage advice.",
    imageUrl: image?.imageUrl ?? null,
    imageAlt: image?.imageAlt ?? null,
    imageSourceUrl: image?.imageSourceUrl ?? null,
    imageSource: image?.imageSource ?? null,
  };
}

async function searchEncyclopedia(term: string, lang: "fr" | "en"): Promise<DictionaryResult | null> {
  const wiki = lang === "en" ? "en.wikipedia.org" : "fr.wikipedia.org";
  const search = await fetchJson("https://" + wiki + "/w/api.php?action=query&list=search&srsearch=" + encodeURIComponent(term) + "&srlimit=5&format=json&origin=*");
  const query = search?.query as RecordObject | undefined;
  const entries = Array.isArray(query?.search) ? query.search as RecordObject[] : [];
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const wanted = normalize(term);
  const entry = entries.find((item) => typeof item.title === "string" && normalize(item.title) === wanted) ?? entries[0];
  if (typeof entry?.title !== "string") return null;
  const page = await fetchJson("https://" + wiki + "/api/rest_v1/page/summary/" + encodeURIComponent(entry.title.replace(/ /g, "_")));
  const definition = cleanText(page?.extract);
  if (!definition) return null;
  const title = typeof page?.title === "string" ? page.title : entry.title;
  const thumbnail = page?.thumbnail as RecordObject | undefined;
  const thumbnailSource = typeof thumbnail?.source === "string" ? thumbnail.source : null;
  const safeImageUrl = thumbnailSource && /^https:\/\/upload\.wikimedia\.org\//i.test(thumbnailSource) ? thumbnailSource : null;
  const articleUrl = "https://" + wiki + "/wiki/" + encodeURIComponent(title.replace(/ /g, "_"));
  return {
    terme: title,
    definition,
    source: lang === "en" ? "English Wikipedia — encyclopedia article" : "Wikipédia en français — article encyclopédique",
    sourceUrl: articleUrl,
    type: lang === "en" ? "Encyclopedia definition" : "Définition encyclopédique",
    notice: lang === "en"
      ? "General reference information, not a diagnosis or treatment recommendation. Consult a healthcare professional for medical decisions. For medicines, refer to the exact leaflet supplied in Cameroon."
      : "Information générale à visée documentaire, pas un diagnostic ni une recommandation de traitement. Pour une décision médicale, consultez un professionnel de santé. Pour les médicaments, référez-vous à la notice exacte délivrée au Cameroun.",
    imageUrl: safeImageUrl,
    imageAlt: safeImageUrl ? (lang === "en" ? "Illustration from encyclopedia article: " : "Illustration issue de l’article encyclopédique : ") + title : null,
    imageSourceUrl: safeImageUrl ? articleUrl : null,
    imageSource: safeImageUrl ? (lang === "en" ? "English Wikipedia" : "Wikipédia en français") : null,
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const term = (params.get("q") ?? "").trim().slice(0, 100);
  const lang = params.get("lang") === "en" ? "en" : "fr";
  if (params.get("suggest") === "1") {
    if (term.length < 2) return NextResponse.json({ suggestions: [] });
    const wiki = lang === "en" ? "en.wikipedia.org" : "fr.wikipedia.org";
    const search = await fetchJson("https://" + wiki + "/w/api.php?action=query&list=search&srsearch=" + encodeURIComponent(term) + "&srlimit=8&format=json&origin=*");
    const query = search?.query as RecordObject | undefined;
    const entries = Array.isArray(query?.search) ? query.search as RecordObject[] : [];
    const normalize = (value: string) => value.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const prefix = normalize(term);
    const catalogue = suggestionsMedicalesParLangue[lang].filter((title) => normalize(title).startsWith(prefix));
    const encyclopediaTitles = entries
      .map((item) => typeof item.title === "string" ? item.title : "")
      .filter((title) => title && normalize(title).startsWith(prefix));
    const unique = [...new Set([...catalogue, ...encyclopediaTitles])].slice(0, 3);
    return NextResponse.json({ suggestions: unique }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800" },
    });
  }
  const messages = lang === "en"
    ? {
        short: "Enter at least two characters.",
        missing: "No sufficiently reliable definition was found in English. Try another term or check the spelling.",
      }
    : {
        short: "Saisissez au moins deux caractères.",
        missing: "Aucune définition suffisamment fiable n’a été trouvée en français. Essayez un autre terme ou vérifiez l’orthographe.",
      };
  if (term.length < 2) {
    return NextResponse.json({ error: messages.short }, { status: 400 });
  }

  // Search in the user's selected language. The FDA label feed is English-only,
  // so it is used only when the interface is set to English.
  const drug = lang === "en" ? await searchDrugLabel(term) : null;
  const result = drug ?? await searchEncyclopedia(term, lang);
  if (!result) {
    return NextResponse.json({ error: messages.missing }, { status: 404 });
  }
  return NextResponse.json({ result }, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}

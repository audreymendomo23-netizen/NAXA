import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RXNORM = "https://rxnav.nlm.nih.gov/REST";
const DAILYMED = "https://dailymed.nlm.nih.gov/dailymed/services/v2";
const USER_AGENT = "NAXA/1.0 (https://naxa.cm; naxa.home@gmail.com)";

type AnyRecord = Record<string, unknown>;
type RxCandidate = { rxcui: string; name: string; score: number | null };
type DailyCandidate = {
  setid: string;
  title: string;
  publishedDate: string | null;
  matchedBy: string;
  rxcui: string | null;
  rxnormScore: number | null;
  imageUrl: string | null;
  imageName: string | null;
  imageKind: "comprime" | null;
  labelUrl: string;
};

async function fetchJson(url: string): Promise<AnyRecord | null> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(9000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("API HTTP " + response.status);
  const value: unknown = await response.json();
  return value && typeof value === "object" ? value as AnyRecord : null;
}

async function fetchXml(url: string): Promise<string | null> {
  const response = await fetch(url, {
    headers: { Accept: "application/xml,text/xml", "User-Agent": USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(9000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("DailyMed SPL HTTP " + response.status);
  return response.text();
}

function extractRxNormCandidates(payload: AnyRecord | null): RxCandidate[] {
  const group = payload?.approximateGroup as AnyRecord | undefined;
  const raw = group?.candidate;
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return values.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const item = value as AnyRecord;
    if (typeof item.rxcui !== "string" || typeof item.name !== "string") return [];
    const score = Number(item.score);
    return [{ rxcui: item.rxcui, name: item.name, score: Number.isFinite(score) ? score : null }];
  }).filter((item) => item.score === null || item.score >= 75).slice(0, 8);
}

function extractSpls(payload: AnyRecord | null): AnyRecord[] {
  const data = payload?.data;
  const rows = Array.isArray(data) ? data : (data as AnyRecord | undefined)?.spls;
  return Array.isArray(rows) ? rows.filter((row) => row && typeof row === "object") as AnyRecord[] : [];
}

function splImageFilename(xml: string): string | null {
  const subjectRegex = new RegExp("<(?:[A-Za-z0-9_-]+:)?subjectOf\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9_-]+:)?subjectOf>", "gi");
  for (const match of xml.matchAll(subjectRegex)) {
    const block = match[1] ?? "";
    if (!new RegExp("<(?:[A-Za-z0-9_-]+:)?code\\b[^>]*\\bcode=[\"']SPLIMAGE[\"']", "i").test(block)) continue;
    const reference = block.match(new RegExp("<(?:[A-Za-z0-9_-]+:)?reference\\b[^>]*\\bvalue=[\"']([^\"']+)[\"']", "i"));
    if (reference?.[1]) return reference[1].replace(/&amp;/g, "&").trim();
  }
  return null;
}
function extractImageMedia(payload: AnyRecord | null): Array<{ name: string; url: string; mimeType: string }> {
  const data = payload?.data as AnyRecord | undefined;
  const media = data?.media ?? payload?.media;
  if (!Array.isArray(media)) return [];
  return media.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as AnyRecord;
    const url = typeof item.url === "string" ? item.url : "";
    const mimeType = typeof item.mime_type === "string" ? item.mime_type : "";
    if (!mimeType.toLowerCase().startsWith("image/") || !url.startsWith("https://dailymed.nlm.nih.gov/")) return [];
    return [{ name: typeof item.name === "string" ? item.name : "", url, mimeType }];
  });
}

async function adminContext() {
  const auth = supabaseServer();
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) return { response: NextResponse.json({ error: "Authentification requise." }, { status: 401 }) };
  const [{ data: profile, error: profileError }, { data: activeRole, error: roleError }] = await Promise.all([
    auth.from("profiles").select("role,actif").eq("id", user.id).maybeSingle(),
    auth.rpc("naxa_business_function"),
  ]);
  if (profileError || roleError || profile?.role !== "admin" || profile.actif !== true || activeRole !== "admin") {
    return { response: NextResponse.json({ error: "Accès réservé à un administrateur NAXA actif." }, { status: 403 }) };
  }
  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  const context = await adminContext();
  if ("response" in context) return context.response;

  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (query.length < 3) return NextResponse.json({ error: "Saisissez au moins trois caractères." }, { status: 400 });

  try {
    const rxUrl = new URL(RXNORM + "/approximateTerm.json");
    rxUrl.searchParams.set("term", query);
    rxUrl.searchParams.set("maxEntries", "8");
    rxUrl.searchParams.set("option", "1");
    const rxPayload = await fetchJson(rxUrl.toString());
    const rxCandidates = extractRxNormCandidates(rxPayload);

    const found = new Map<string, { spl: AnyRecord; matchedBy: string; rx: RxCandidate | null }>();
    const directUrl = new URL(DAILYMED + "/spls.json");
    directUrl.searchParams.set("drug_name", query);
    directUrl.searchParams.set("pagesize", "20");
    for (const spl of extractSpls(await fetchJson(directUrl.toString()))) {
      if (typeof spl.setid === "string") found.set(spl.setid, { spl, matchedBy: "recherche directe DailyMed", rx: null });
    }

    for (const candidate of rxCandidates) {
      const url = new URL(DAILYMED + "/spls.json");
      url.searchParams.set("rxcui", candidate.rxcui);
      url.searchParams.set("pagesize", "20");
      for (const spl of extractSpls(await fetchJson(url.toString()))) {
        if (typeof spl.setid === "string" && !found.has(spl.setid)) {
          found.set(spl.setid, { spl, matchedBy: "RxNorm " + candidate.name, rx: candidate });
        }
      }
    }

    const results: DailyCandidate[] = [];
    for (const [setid, entry] of [...found.entries()].slice(0, 8)) {
      if (!/^[0-9a-f-]{36}$/i.test(setid)) continue;
      const xml = await fetchXml(DAILYMED + "/spls/" + encodeURIComponent(setid) + ".xml");
      const filename = xml ? splImageFilename(xml) : null;
      let imageUrl: string | null = null;
      let imageName: string | null = filename;
      if (filename) {
        const mediaPayload = await fetchJson(DAILYMED + "/spls/" + encodeURIComponent(setid) + "/media.json");
        const wanted = filename.split("/").pop()?.toLowerCase();
        const match = extractImageMedia(mediaPayload).find((item) => {
          const name = item.name.split("/").pop()?.toLowerCase();
          let urlName = "";
          try { urlName = new URL(item.url).pathname.split("/").pop()?.toLowerCase() ?? ""; } catch { /* URL ignorée */ }
          return name === wanted || urlName === wanted;
        });
        if (match) {
          imageUrl = match.url;
          imageName = match.name || filename;
        }
      }
      results.push({
        setid,
        title: typeof entry.spl.title === "string" ? entry.spl.title : "Notice SPL sans titre",
        publishedDate: typeof entry.spl.published_date === "string" ? entry.spl.published_date : null,
        matchedBy: entry.matchedBy,
        rxcui: entry.rx?.rxcui ?? null,
        rxnormScore: entry.rx?.score ?? null,
        imageUrl,
        imageName,
        imageKind: imageUrl ? "comprime" : null,
        labelUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=" + encodeURIComponent(setid),
      } as DailyCandidate);
    }

    return NextResponse.json({
      query,
      rxnormCandidates,
      results,
      notice: "Recherche directe RxNorm → DailyMed. SPLIMAGE est une image de forme orale solide, pas une photo de boîte. Droits de reproduction à confirmer auprès du titulaire avant toute publication.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("NAXA_DAILYMED_IMAGE_SEARCH_FAILED", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Recherche DailyMed momentanément indisponible." }, { status: 503 });
  }
}

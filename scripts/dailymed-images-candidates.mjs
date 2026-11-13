#!/usr/bin/env node
/**
 * DailyMed v2 discovery for NAXA medicine-image queue.
 *
 * DailyMed exposes SPL labels and their attached media, but the media endpoint
 * does not return per-image copyright/license metadata. This importer therefore
 * records candidates for human rights/identity review and NEVER publishes an
 * image URL into image_url. Public display remains blocked until rights are
 * independently verified.
 *
 * Usage: node scripts/dailymed-images-candidates.mjs [--limit=25] [--dry-run]
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and
 * SUPABASE_SERVICE_ROLE_KEY. Never expose the service key to the browser.
 */
import { pathToFileURL } from "node:url";

const BASE = "https://dailymed.nlm.nih.gov/dailymed/services/v2";
const RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST";
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Math.max(1, Math.min(100, Number(process.argv.find((x) => x.startsWith("--limit="))?.split("=")[1] ?? 25)));
const USER_AGENT = "NAXA/1.0 (https://naxa.cm; naxa.home@gmail.com)";
const DELAY_MS = 1200;

export const normalize = (value = "") => String(value).normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const tokens = (value = "") => normalize(value).split(/\s+/).filter((x) =>
  x.length >= 3 && !/^\d+$/.test(x) &&
  !/^(?:comprime|comprimés|tablet|tablets|capsule|capsules|gelule|gelules|mg|mcg|ug|ml|iu|ui|oral|solution|injection)$/.test(x)
);

export function extractSpls(payload) {
  const candidates = Array.isArray(payload?.data)
    ? payload.data
    : payload?.data?.spls ?? payload?.spls ?? payload?.data?.data?.spls ?? [];
  return Array.isArray(candidates) ? candidates : [];
}

export function extractMedia(payload) {
  const candidates = payload?.data?.media ?? payload?.media ?? payload?.data?.data?.media ?? [];
  return Array.isArray(candidates) ? candidates.filter((x) =>
    String(x?.mime_type ?? "").toLowerCase().startsWith("image/") &&
    typeof x?.url === "string" && x.url.startsWith("https://dailymed.nlm.nih.gov/")
  ) : [];
}

/** Extrait uniquement la référence SPLIMAGE (vue du comprimé/gélule), pas les schémas de notice. */
export function extractSplImageFilename(xml) {
  if (typeof xml !== "string" || !xml) return null;
  const subjectRegex = new RegExp("<(?:[A-Za-z0-9_-]+:)?subjectOf\\\\b[^>]*>([\\\\s\\\\S]*?)<\\\\/(?:[A-Za-z0-9_-]+:)?subjectOf>", "gi");
  for (const match of xml.matchAll(subjectRegex)) {
    const block = match[1] ?? "";
    if (!new RegExp("<(?:[A-Za-z0-9_-]+:)?code\\\\b[^>]*\\\\bcode=[\"']SPLIMAGE[\"']", "i").test(block)) continue;
    const reference = block.match(new RegExp("<(?:[A-Za-z0-9_-]+:)?reference\\\\b[^>]*\\\\bvalue=[\"']([^\"']+)[\"']", "i"));
    if (reference?.[1]) return reference[1].replace(/&amp;/g, "&").trim();
  }
  return null;
}

export function titleMatches(identity, title) {
  const wanted = tokens(identity);
  const actual = new Set(tokens(title));
  if (!wanted.length || !actual.size) return false;
  const hits = wanted.filter((token) => actual.has(token));
  const required = wanted.length <= 2 ? wanted.length : 2;
  return hits.length >= required;
}

export function extractRxNormCandidates(payload) {
  const group = payload?.approximateGroup ?? payload?.rxnormdata?.approximateGroup ?? {};
  const raw = group?.candidate ?? [];
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).filter((item) => item?.rxcui && item?.name)
    .map((item) => ({ rxcui: String(item.rxcui), name: String(item.name), score: Number(item.score ?? 0),
      rank: Number(item.rank ?? 0), source: item.source ? String(item.source) : null }));
}

async function fetchRxNormTerms(term) {
  const normalizedUrl = new URL(RXNORM_BASE + "/rxcui.json");
  normalizedUrl.searchParams.set("name", term);
  normalizedUrl.searchParams.set("search", "2");
  normalizedUrl.searchParams.set("allsrc", "0");
  const normalizedResponse = await fetch(normalizedUrl, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(12000)
  });
  if (normalizedResponse.ok) {
    const payload = await normalizedResponse.json();
    const ids = payload?.idGroup?.rxnormId ?? [];
    const names = [];
    for (const rxcui of (Array.isArray(ids) ? ids : ids ? [ids] : []).slice(0, 5)) {
      const detailUrl = new URL(RXNORM_BASE + "/rxcui/" + encodeURIComponent(rxcui) + "/properties.json");
      const response = await fetch(detailUrl, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(12000)
      });
      if (response.ok) {
        const p = (await response.json())?.properties;
        if (p?.name) names.push({ rxcui: String(rxcui), name: p.name, score: null, rank: null, source: "RXNORM_NORMALIZED" });
      }
      await wait(DELAY_MS);
    }
    if (names.length) return names;
  } else if (normalizedResponse.status !== 404) {
    throw new Error("RxNorm normalized search HTTP " + normalizedResponse.status);
  }
  const approximateUrl = new URL(RXNORM_BASE + "/approximateTerm.json");
  approximateUrl.searchParams.set("term", term);
  approximateUrl.searchParams.set("maxEntries", "10");
  approximateUrl.searchParams.set("option", "1");
  const response = await fetch(approximateUrl, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error("RxNorm approximate search HTTP " + response.status);
  }
  return extractRxNormCandidates(await response.json());
}

const rxNormCache = new Map();
export function resolveRxNormTerms(term) {
  const key = normalize(term);
  if (!key) return Promise.resolve([]);
  if (rxNormCache.has(key)) return rxNormCache.get(key);
  const pending = fetchRxNormTerms(String(term).trim()).catch((error) => {
    rxNormCache.delete(key);
    throw error;
  });
  rxNormCache.set(key, pending);
  if (rxNormCache.size > 500) rxNormCache.delete(rxNormCache.keys().next().value);
  return pending;
}

export function buildCandidateUpdate(row, ref, candidates, rxnormCandidates = []) {
  const first = candidates[0];
  const splImage = first.splimage ?? first.media?.[0] ?? null;
  return {
    image_url: splImage?.url ?? null,
    image_path: null,
    source_nom: "DailyMed — NLM / SPLIMAGE",
    source_url: first.label_url,
    licence: "Droits de reproduction de l'image SPLIMAGE à confirmer auprès du titulaire avant affichage public",
    statut: "correspondance_a_verifier",
    methode_correspondance: JSON.stringify({
      provider: "RxNorm → DailyMed v2 / SPLIMAGE",
      match: "RxCUI résolu via RxNorm puis notice SPL DailyMed; image SPLIMAGE de forme orale solide, non preuve du conditionnement commercial",
      splimage_name: splImage?.name ?? null,
      cis: row.cis,
      cip_code: row.cip_code,
      nom_bdpm: ref.nom,
      rxnorm_candidates: rxnormCandidates,
      spl_candidates: candidates
    })
  };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(12000)
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("DailyMed HTTP " + response.status);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/xml,text/xml", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(12000)
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("DailyMed SPL XML HTTP " + response.status);
  return response.text();
}

export async function searchDailyMed(identity) {
  // DailyMed v2 ne documente pas drug_name comme filtre de /spls.
  // RxNorm résout d'abord le nom BDPM en RxCUI, puis DailyMed est interrogée
  // directement avec son filtre officiel rxcui.
  const resolved = await resolveRxNormTerms(identity);
  const bySetId = new Map();
  for (const candidate of resolved.slice(0, 8)) {
    const url = new URL(BASE + "/spls.json");
    url.searchParams.set("rxcui", candidate.rxcui);
    url.searchParams.set("pagesize", "20");
    const payload = await fetchJson(url);
    for (const spl of extractSpls(payload)) {
      if (spl?.setid) bySetId.set(String(spl.setid), {
        ...spl,
        rxnorm_rxcui: candidate.rxcui,
        rxnorm_name: candidate.name,
        rxnorm_score: candidate.score ?? null
      });
    }
    await wait(DELAY_MS);
  }
  return [...bySetId.values()];
}

export async function getSplMedia(setid) {
  if (!/^[0-9a-f-]{36}$/i.test(String(setid ?? ""))) return [];
  const encoded = encodeURIComponent(setid);
  const xml = await fetchText(BASE + "/spls/" + encoded + ".xml");
  const filename = extractSplImageFilename(xml ?? "");
  if (!filename) return [];
  const payload = await fetchJson(BASE + "/spls/" + encoded + "/media.json");
  const media = extractMedia(payload);
  const wanted = filename.split("/").pop()?.toLowerCase();
  if (!wanted) return [];
  const matched = media.find((item) => {
    const name = String(item.name ?? "").split("/").pop()?.toLowerCase();
    let urlName = "";
    try { urlName = new URL(item.url).pathname.split("/").pop()?.toLowerCase() ?? ""; } catch { /* URL refusée */ }
    return name === wanted || urlName === wanted;
  });
  return matched ? [{ ...matched, splimage: true }] : [];
}

function getRestBase() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Variables requises : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.");
  return SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";
}
async function supabase(path, options = {}) {
  const response = await fetch(getRestBase() + path, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("Supabase REST " + response.status + ": " + (await response.text()).slice(0, 400));
  return response.status === 204 ? null : response.json();
}

async function main() {
  console.log("NAXA — DailyMed v2 | limite=" + LIMIT + " | dry-run=" + DRY_RUN);
  const queueParams = new URLSearchParams({
    select: "cis,cip_code,libelle_presentation,statut",
    statut: "in.(a_traiter,sans_image_source,erreur,correspondance_a_verifier)",
    order: "updated_at.asc",
    limit: String(LIMIT)
  });
  const queue = await supabase("/medicaments_images?" + queueParams);
  const cis = [...new Set((queue ?? []).map((x) => x.cis))];
  const refs = cis.length ? await supabase("/medicaments_referentiel_sources?" + new URLSearchParams({
    select: "cis,nom,substances_actives",
    cis: "in.(" + cis.join(",") + ")"
  })) : [];
  const byCis = new Map((refs ?? []).map((x) => [x.cis, x]));
  const report = { queued: queue?.length ?? 0, searched: 0, candidates: 0, media: 0, stored_for_review: 0, no_match: 0, errors: 0, items: [] };

  for (const row of queue ?? []) {
    const ref = byCis.get(row.cis);
    if (!ref?.nom) { report.no_match++; continue; }
    report.searched++;
    const ingredients = String(ref.substances_actives ?? "").split(/[;,|]/).map((x) => x.trim()).filter(Boolean);
    const baseIdentities = [...new Set([ref.nom, ...ingredients])].slice(0, 4);
    const found = new Map();
    const rxnormCandidates = [];
    try {
      const identities = new Set(baseIdentities);
      for (const identity of baseIdentities) {
        const resolved = await resolveRxNormTerms(identity);
        for (const candidate of resolved) {
          rxnormCandidates.push({ query: identity, ...candidate });
          identities.add(candidate.name);
        }
        await wait(DELAY_MS);
      }
      for (const identity of [...identities].slice(0, 12)) {
        const spls = await searchDailyMed(identity);
        for (const spl of spls) {
          if (spl.setid) found.set(spl.setid, { ...spl, matched_identity: identity });
        }
        await wait(DELAY_MS);
      }
      const candidates = [];
      for (const spl of [...found.values()].slice(0, 5)) {
        const media = await getSplMedia(spl.setid);
        if (media.length) {
          const labelUrl = "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=" + encodeURIComponent(spl.setid);
          candidates.push({
            setid: spl.setid,
            title: spl.title ?? null,
            published_date: spl.published_date ?? null,
            label_url: labelUrl,
            matched_identity: spl.matched_identity,
            splimage: { name: media[0].name, mime_type: media[0].mime_type, url: media[0].url },
            media: media.map((item) => ({ name: item.name, mime_type: item.mime_type, url: item.url }))
          });
          report.media += media.length;
        }
        await wait(DELAY_MS);
      }
      if (!candidates.length) {
        report.no_match++;
        report.items.push({ cis: row.cis, cip_code: row.cip_code, result: "aucun_media_dailymed_correspondant" });
        continue;
      }
      report.candidates += candidates.length;
      const update = buildCandidateUpdate(row, ref, candidates, rxnormCandidates);
      if (!DRY_RUN) {
        const key = new URLSearchParams({ cis: "eq." + row.cis, cip_code: "eq." + row.cip_code });
        await supabase("/medicaments_images?" + key, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(update)
        });
      }
      report.stored_for_review++;
      report.items.push({
        cis: row.cis, cip_code: row.cip_code, nom: ref.nom,
        result: DRY_RUN ? "candidat_simule" : "candidat_enregistre_a_verifier",
        spl_candidates: candidates
      });
    } catch (error) {
      report.errors++;
      report.items.push({ cis: row.cis, cip_code: row.cip_code, result: "erreur", error: error.message });
    }
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.errors) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error); process.exit(1); });
}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const USER_AGENT = "NAXA/1.0 (https://naxa.cm; naxa.home@gmail.com)";
const MAX_BATCH = 10;
const WAIT_MS = 1200;
const DAILY = "https://dailymed.nlm.nih.gov/dailymed/services/v2";
const RX = "https://rxnav.nlm.nih.gov/REST";

const cors = {
  "Access-Control-Allow-Origin": "https://naxa.cm",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const normalize = (v = "") => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (v = "") => normalize(v).split(/\s+/).filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !/^(?:comprime|comprimes|tablet|tablets|capsule|capsules|gelule|gelules|mg|mcg|ug|ml|iu|ui|oral|solution|injection|medicine|medicament|drug)$/.test(t));
const safeHttps = (v: string | undefined) => { try { const u = new URL(v ?? ""); return u.protocol === "https:" ? u.toString() : null; } catch { return null; } };
const barcodeValid = (v: unknown) => /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(String(v ?? ""));
const titleMatches = (identity: string, title: string) => {
  const wanted = tokens(identity), actual = new Set(tokens(title));
  const hits = wanted.filter((t) => actual.has(t));
  return wanted.length > 0 && hits.length >= (wanted.length <= 2 ? wanted.length : 2);
};
async function fetchJson(url: string, provider: string) {
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(12000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(provider + " HTTP " + res.status);
  return res.json();
}
function extractSpls(payload: any) {
  const data = payload?.data;
  const list = Array.isArray(data) ? data : data?.spls ?? payload?.spls ?? data?.data?.spls ?? [];
  return Array.isArray(list) ? list : [];
}
function extractMedia(payload: any) {
  const list = payload?.data?.media ?? payload?.media ?? payload?.data?.data?.media ?? [];
  return Array.isArray(list) ? list.filter((m: any) =>
    String(m?.mime_type ?? "").toLowerCase().startsWith("image/") &&
    typeof m?.url === "string" && m.url.startsWith("https://dailymed.nlm.nih.gov/")
  ) : [];
}
async function rxNormNames(term: string) {
  const url = new URL(RX + "/approximateTerm.json");
  url.searchParams.set("term", term);
  url.searchParams.set("maxEntries", "5");
  url.searchParams.set("option", "1");
  const payload = await fetchJson(url.toString(), "RxNorm");
  const raw = payload?.approximateGroup?.candidate ?? [];
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).filter((x: any) => x?.rxcui && x?.name)
    .map((x: any) => ({ rxcui: String(x.rxcui), name: String(x.name), score: Number(x.score ?? 0), rank: Number(x.rank ?? 0) }));
}
async function dailyMedCandidates(ref: any, row: any) {
  const ingredients = String(ref.substances_actives ?? "").split(/[;,|]/).map((x: string) => x.trim()).filter(Boolean);
  const baseTerms = [...new Set([ref.nom, ...ingredients])].slice(0, 3);
  const terms = new Set<string>(baseTerms);
  const rxnorm: any[] = [];
  for (const term of baseTerms) {
    try {
      const found = await rxNormNames(term);
      for (const candidate of found) { rxnorm.push({ query: term, ...candidate }); terms.add(candidate.name); }
    } catch { /* RxNorm reste facultatif : la recherche DailyMed continue. */ }
    await wait(WAIT_MS);
  }
  const spls = new Map<string, any>();
  for (const term of [...terms].slice(0, 7)) {
    const url = new URL(DAILY + "/spls.json");
    url.searchParams.set("drug_name", term);
    url.searchParams.set("name_type", "generic");
    url.searchParams.set("pagesize", "20");
    const payload = await fetchJson(url.toString(), "DailyMed");
    for (const spl of extractSpls(payload)) {
      if (spl?.setid && titleMatches(term, String(spl.title ?? spl.drug_name ?? ""))) {
        spls.set(String(spl.setid), { ...spl, matched_identity: term });
      }
    }
    await wait(WAIT_MS);
  }
  const candidates: any[] = [];
  for (const spl of [...spls.values()].slice(0, 5)) {
    const media = extractMedia(await fetchJson(DAILY + "/spls/" + encodeURIComponent(spl.setid) + "/media.json", "DailyMed"));
    if (media.length) candidates.push({
      setid: spl.setid, title: spl.title ?? null, published_date: spl.published_date ?? null,
      label_url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=" + encodeURIComponent(spl.setid),
      matched_identity: spl.matched_identity,
      media: media.map((m: any) => ({ name: m.name ?? null, mime_type: m.mime_type, url: m.url })),
    });
    await wait(WAIT_MS);
  }
  if (!candidates.length) return null;
  return {
    image_url: null,
    image_path: null,
    source_nom: "DailyMed — National Library of Medicine (SPL)",
    source_url: candidates[0].label_url,
    licence: "Droits de chaque média non fournis par l'API — validation des droits obligatoire avant publication",
    statut: "correspondance_a_verifier",
    methode_correspondance: JSON.stringify({
      provider: "DailyMed v2 (source prioritaire)",
      match: "recherche par nom générique et RxNorm; correspondance de notice, non preuve d'identité du conditionnement",
      cis: row.cis, cip_code: row.cip_code, nom_bdpm: ref.nom,
      rxnorm_candidates: rxnorm, spl_candidates: candidates,
    }),
  };
}
function commonsRights(info: any) {
  const meta = info.extmetadata ?? {};
  const clean = (v: string | undefined) => (v ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const short = clean(meta.LicenseShortName?.value), terms = clean(meta.UsageTerms?.value), licenseUrl = clean(meta.LicenseUrl?.value);
  if (!/^(?:CC0(?:\s|$)|Public domain(?:\s|$)|CC BY(?:-SA)?(?:\s|$))/i.test(short)) return null;
  if (/\b(?:NC|ND)\b|non[ -]?commercial|no[ -]?derivatives/i.test(short + " " + terms)) return null;
  if (!licenseUrl && !/^Public domain/i.test(short) && !/^CC0/i.test(short)) return null;
  return { licence: [short, terms, licenseUrl].filter(Boolean).join(" — "), attribution: clean(meta.Artist?.value ?? meta.Credit?.value) || "Attribution non fournie" };
}
async function openProductsFacts(barcode: string, identity: string) {
  if (!barcodeValid(barcode)) return null;
  const url = "https://world.openproductsfacts.org/api/v2/product/" + encodeURIComponent(barcode) + ".json?fields=code,product_name,brands,categories_tags,image_front_url";
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const data = await res.json(), p = data.product;
  if (data.status !== 1 || !p || String(p.code ?? data.code) !== String(barcode)) return null;
  if (!/(?:medicines?|medications?|pharmaceutical|drugs?)/.test((p.categories_tags ?? []).join(" ").toLowerCase())) return null;
  const identityText = normalize([p.product_name, p.brands].filter(Boolean).join(" "));
  const wanted = tokens(identity);
  if (!wanted.length || !wanted.some((t) => identityText.split(" ").includes(t))) return null;
  const image = safeHttps(p.image_front_url);
  if (!image || !["images.openproductsfacts.org", "images.openfoodfacts.org"].includes(new URL(image).hostname.toLowerCase())) return null;
  return { image_url: image, source_nom: "Open Products Facts", source_url: "https://world.openproductsfacts.org/product/" + barcode,
    licence: "CC BY-SA 4.0 — Open Products Facts (attribution et partage à l'identique requis)",
    methode_correspondance: "GTIN exact " + barcode + " + identité produit contrôlée" };
}
async function wikimedia(identity: string) {
  if (!tokens(identity).length) return null;
  const params = new URLSearchParams({ action: "query", generator: "search", gsrsearch: "filetype:bitmap " + identity.trim().slice(0, 120),
    gsrnamespace: "6", gsrlimit: "20", prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "640", format: "json" });
  const res = await fetch("https://commons.wikimedia.org/w/api.php?" + params, { headers: { Accept: "application/json", "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  const data = await res.json();
  for (const page of Object.values(data.query?.pages ?? {}) as any[]) {
    const wanted = tokens(identity), actual = new Set(tokens(String(page.title ?? "").replace(/^File:/i, "")));
    if (!wanted.length || wanted.filter((t) => actual.has(t)).length < (wanted.length <= 2 ? wanted.length : 2)) continue;
    const info = page.imageinfo?.[0], image = safeHttps(info?.thumburl ?? info?.url), source = safeHttps(info?.descriptionurl);
    const rights = info && commonsRights(info);
    if (!image || !source || !rights) continue;
    return { image_url: image, source_nom: "Wikimedia Commons", source_url: source,
      licence: rights.licence + " — Attribution : " + rights.attribution,
      methode_correspondance: "Titre Commons : identité contrôlée (" + page.title + ")" };
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token || !SUPABASE_URL || !SERVICE_KEY) return json({ error: "Configuration ou session manquante" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Session invalide" }, 401);
    const { data: profile, error: profileError } = await admin.from("profiles").select("role,actif").eq("id", userData.user.id).maybeSingle();
    if (profileError || profile?.role !== "admin" || profile?.actif === false) return json({ error: "Accès réservé à un compte Admin NAXA actif" }, 403);

    const body = await req.json().catch(() => ({}));
    const offset = Number.isInteger(body.offset) && body.offset >= 0 ? body.offset : 0;
    const limit = Number.isInteger(body.limit) ? Math.min(MAX_BATCH, Math.max(1, body.limit)) : MAX_BATCH;
    const { data: rows, error: queueError } = await admin.from("medicaments_images").select("cis,cip_code,libelle_presentation")
      .in("statut", ["a_traiter", "sans_image_source", "erreur"]).order("updated_at", { ascending: true }).range(offset, offset + limit - 1);
    if (queueError) throw queueError;
    if (!rows?.length) return json({ ok: true, offset, processed: 0, message: "Fin de file atteinte" });
    const cis = [...new Set(rows.map((r: any) => r.cis))];
    const { data: refs, error: refError } = await admin.from("medicaments_referentiel_sources").select("cis,nom,substances_actives").in("cis", cis);
    if (refError) throw refError;
    const names = new Map((refs ?? []).map((r: any) => [r.cis, r]));
    const report = { ok: true, offset, queued: rows.length, attempted: 0, dailymed_candidates: 0, opf: 0, commons: 0, missing: 0, errors: 0 };
    for (const row of rows as any[]) {
      report.attempted++;
      const ref = names.get(row.cis);
      if (!ref?.nom) { report.missing++; continue; }
      try {
        // DailyMed est la source prioritaire. Ses images sont enregistrées comme candidates,
        // jamais publiées sans preuve des droits et de l'identité du conditionnement.
        const dailyUpdate = await dailyMedCandidates(ref, row);
        if (dailyUpdate) {
          const { error } = await admin.from("medicaments_images").update(dailyUpdate).eq("cis", row.cis).eq("cip_code", row.cip_code);
          if (error) throw error;
          report.dailymed_candidates++;
          continue;
        }
        let photo: any = null;
        if (barcodeValid(row.cip_code)) {
          try { photo = await openProductsFacts(row.cip_code, ref.nom); } catch { /* repli autorisé */ }
        }
        if (!photo) {
          try { photo = await wikimedia(ref.nom); } catch { /* repli autorisé */ }
        }
        if (!photo) report.missing++;
        else {
          const { error } = await admin.from("medicaments_images").update({
            image_path: null, image_url: photo.image_url, source_nom: photo.source_nom, source_url: photo.source_url,
            licence: photo.licence, statut: "image_stockee", methode_correspondance: photo.methode_correspondance,
          }).eq("cis", row.cis).eq("cip_code", row.cip_code);
          if (error) throw error;
          if (photo.source_nom === "Open Products Facts") report.opf++; else report.commons++;
        }
      } catch (error) {
        report.errors++;
        console.error("NAXA image import row error", row.cis, error);
      }
      await wait(400);
    }
    return json(report);
  } catch (error) {
    console.error("naxa-images-import", error);
    return json({ error: "Échec de traitement du lot" }, 500);
  }
});

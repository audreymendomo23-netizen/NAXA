#!/usr/bin/env node
/**
 * Récupération contrôlée des photos libres pour les présentations BDPM.
 *
 * Source de vérité : public.medicaments_images (clé CIS + CIP).
 * Open Products Facts : GTIN/CIP exact obligatoire, photo distante CC BY-SA.
 * Wikimedia Commons : identité distincte + licence commerciale vérifiée.
 *
 * Usage : node scripts/medicaments-images-cameroun.mjs [--limit=40] [--dry-run]
 * Nécessite SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY.
 */
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Math.max(1, Math.min(250, Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? 40)));
const USER_AGENT = "NAXA/1.0 (https://naxa.cm; naxa.home@gmail.com)";
const DELAY_MS = 4100; // plafond prudent : 15 lectures produit par minute

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Variables requises : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

const REST = SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";
const apiHeaders = {
  apikey: SERVICE_KEY,
  Authorization: "Bearer " + SERVICE_KEY,
  Accept: "application/json",
  "Content-Type": "application/json"
};
async function supabaseRequest(path, options = {}) {
  const response = await fetch(REST + path, {
    ...options,
    headers: { ...apiHeaders, ...(options.headers ?? {}) },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error("Supabase REST " + response.status + " : " + detail.slice(0, 500));
  }
  if (response.status === 204) return null;
  return response.json();
}

const normalize = (value = "") => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (value = "") => normalize(value).split(/\s+/).filter((token) =>
  token.length >= 3 && !/^\d+$/.test(token) &&
  !/^(?:comprime|comprimes|tablet|tablets|capsule|capsules|gelule|gelules|boite|box|mg|mcg|ug|ml|iu|ui|medicine|medicament|drug|pharmaceutical)$/.test(token)
);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const barcodeValid = (value) => /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(String(value ?? ""));
const safeHttps = (value) => {
  try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : null; }
  catch { return null; }
};

function commonsRights(info) {
  const meta = info.extmetadata ?? {};
  const clean = (value) => (value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const short = clean(meta.LicenseShortName?.value);
  const terms = clean(meta.UsageTerms?.value);
  const licenseUrl = clean(meta.LicenseUrl?.value);
  if (!/^(?:CC0(?:\s|$)|Public domain(?:\s|$)|CC BY(?:-SA)?(?:\s|$))/i.test(short)) return null;
  if (/\b(?:NC|ND)\b|non[ -]?commercial|no[ -]?derivatives/i.test(short + " " + terms)) return null;
  if (!licenseUrl && !/^Public domain/i.test(short) && !/^CC0/i.test(short)) return null;
  return {
    licence: [short, terms, licenseUrl].filter(Boolean).join(" — "),
    attribution: clean(meta.Artist?.value ?? meta.Credit?.value) || "Attribution non fournie par Wikimedia Commons"
  };
}

function titleMatches(query, title) {
  const wanted = tokens(query);
  const actual = new Set(tokens(title.replace(/^File:/i, "")));
  if (!wanted.length) return false;
  const hits = wanted.filter((token) => actual.has(token));
  // Une identité courte doit correspondre intégralement ; pour un nom long,
  // deux ancres distinctives suffisent (marque + substance, ou deux éléments du nom).
  // Les recherches restent limitées au nom exact du médicament, jamais à sa classe.
  const requiredHits = wanted.length <= 2 ? wanted.length : 2;
  return hits.length >= requiredHits;
}

async function openProductsFacts(barcode, identity) {
  if (!barcodeValid(barcode)) return null;
  const fields = "code,product_name,brands,categories_tags,image_front_url,images";
  const url = "https://world.openproductsfacts.org/api/v2/product/" + encodeURIComponent(barcode) + ".json?fields=" + fields;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) return null;
  const json = await response.json();
  const product = json.product;
  if (json.status !== 1 || !product || String(product.code ?? json.code) !== String(barcode)) return null;
  const categories = (product.categories_tags ?? []).join(" ").toLowerCase();
  if (!/(?:medicines?|medications?|pharmaceutical|drugs?)/.test(categories)) return null;
  const productIdentity = normalize([product.product_name, product.brands].filter(Boolean).join(" "));
  const wanted = tokens(identity);
  if (!wanted.length || !wanted.some((token) => productIdentity.split(" ").includes(token))) return null;
  const imageUrl = safeHttps(product.image_front_url);
  const imageHost = imageUrl ? new URL(imageUrl).hostname.toLowerCase() : "";
  // OPF partage l'infrastructure officielle d'images Open Facts.
  if (!imageUrl || !["images.openproductsfacts.org", "images.openfoodfacts.org"].includes(imageHost)) return null;
  return {
    image_url: imageUrl,
    source_nom: "Open Products Facts",
    source_url: "https://world.openproductsfacts.org/product/" + barcode,
    licence: "CC BY-SA 4.0 — Open Products Facts (attribution et partage à l'identique requis)",
    methode_correspondance: "GTIN exact " + barcode + " + identité produit contrôlée"
  };
}

async function wikimedia(identity) {
  const wanted = tokens(identity);
  if (!wanted.length) return null;
  const query = identity.trim().slice(0, 120);
  const params = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: "filetype:bitmap " + query,
    gsrnamespace: "6", gsrlimit: "20", prop: "imageinfo", iiprop: "url|extmetadata",
    iiurlwidth: "640", format: "json"
  });
  const response = await fetch("https://commons.wikimedia.org/w/api.php?" + params, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) return null;
  const json = await response.json();
  const pages = Object.values(json.query?.pages ?? {});
  for (const page of pages) {
    if (!titleMatches(identity, page.title ?? "")) continue;
    const info = page.imageinfo?.[0];
    const imageUrl = safeHttps(info?.thumburl ?? info?.url);
    const sourceUrl = safeHttps(info?.descriptionurl);
    const rights = info && commonsRights(info);
    if (!imageUrl || !sourceUrl || !rights) continue;
    return {
      image_url: imageUrl,
      source_nom: "Wikimedia Commons",
      source_url: sourceUrl,
      licence: rights.licence + " — Attribution : " + rights.attribution,
      methode_correspondance: "Titre Commons : identité distincte contrôlée (" + page.title + ")"
    };
  }
  return null;
}

async function loadQueue() {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const params = new URLSearchParams({
      select: "cis,cip_code,libelle_presentation,image_path,image_url,source_nom,source_url,licence,statut",
      statut: "in.(a_traiter,sans_image_source,erreur)",
      order: "updated_at.asc",
      limit: "500",
      offset: String(offset)
    });
    const data = await supabaseRequest("/medicaments_images?" + params.toString());
    rows.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  return rows;
}

async function loadNames(cisList) {
  const map = new Map();
  for (let offset = 0; offset < cisList.length; offset += 100) {
    const batch = cisList.slice(offset, offset + 100);
    const params = new URLSearchParams({
      select: "cis,nom,substances_actives",
      cis: "in.(" + batch.join(",") + ")"
    });
    const data = await supabaseRequest("/medicaments_referentiel_sources?" + params.toString());
    for (const row of data ?? []) map.set(row.cis, row);
  }
  return map;
}

async function savePhoto(row, photo) {
  const update = {
    image_path: null,
    image_url: photo.image_url,
    source_nom: photo.source_nom,
    source_url: photo.source_url,
    licence: photo.licence,
    statut: "image_stockee",
    methode_correspondance: photo.methode_correspondance
  };
  if (DRY_RUN) return update;
  const params = new URLSearchParams({ cis: "eq." + row.cis, cip_code: "eq." + row.cip_code });
  await supabaseRequest("/medicaments_images?" + params.toString(), {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(update)
  });
  return update;
}

async function main() {
  console.log("NAXA — import images par CIS/CIP | limite=" + LIMIT + " | dry-run=" + DRY_RUN);
  const queue = await loadQueue();
  const names = await loadNames([...new Set(queue.map((row) => row.cis))]);
  const report = { queued: queue.length, attempted: 0, found: 0, opf: 0, commons: 0, missing: 0, errors: 0, items: [] };
  for (const row of queue.slice(0, LIMIT)) {
    report.attempted++;
    const ref = names.get(row.cis);
    if (!ref?.nom) {
      report.missing++;
      report.items.push({ cis: row.cis, cip: row.cip_code, result: "nom_BDPM_absent" });
      continue;
    }
    const identity = [ref.nom, ref.substances_actives].filter(Boolean).join(" ");
    try {
      let photo = null;
      // OPF n'est interrogé que sur le CIP exact, jamais par nom.
      if (barcodeValid(row.cip_code)) {
        try { photo = await openProductsFacts(row.cip_code, ref.nom); }
        catch (error) { console.warn("OPF indisponible", row.cip_code, error.message); }
      }
      if (!photo) {
        try { photo = await wikimedia(ref.nom); }
        catch (error) { console.warn("Commons indisponible", row.cis, error.message); }
      }
      if (!photo) {
        report.missing++;
        report.items.push({ cis: row.cis, cip: row.cip_code, result: "aucune_correspondance_libre" });
      } else {
        await savePhoto(row, photo);
        report.found++;
        if (photo.source_nom === "Open Products Facts") report.opf++;
        else report.commons++;
        report.items.push({ cis: row.cis, cip: row.cip_code, nom: ref.nom, result: DRY_RUN ? "simulation" : "image_stockee", source: photo.source_nom, url: photo.source_url, licence: photo.licence });
      }
    } catch (error) {
      report.errors++;
      report.items.push({ cis: row.cis, cip: row.cip_code, result: "erreur", error: error.message });
    }
    await delay(DELAY_MS);
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.errors) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exit(1); });

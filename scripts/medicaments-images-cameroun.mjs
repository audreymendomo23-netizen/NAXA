#!/usr/bin/env node
/**
 * Import contrôlé des photos libres du catalogue médicaments NAXA.
 *
 * Pré-requis : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans l'environnement.
 * Usage : node scripts/medicaments-images-cameroun.mjs [--limit=40] [--dry-run]
 *
 * Le script ne scrape pas Google Images. Il utilise l'API Wikimedia Commons,
 * n'accepte que les licences CC0, domaine public, CC BY ou CC BY-SA compatibles
 * avec un usage commercial, conserve source/licence/attribution, et n'invente
 * jamais une photo lorsqu'aucune correspondance sûre n'est trouvée.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Math.max(1, Math.min(250, Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? 40)));
const BUCKET = "medicaments";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const USER_AGENT = "NAXA-MedicamentImageImporter/1.0 (naxa.home@gmail.com)";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Variables requises : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const PRIORITY = [
  ["Paracétamol", ["paracetamol", "acetaminophen", "doliprane", "efferalgan", "dafalgan"]],
  ["Amoxicilline", ["amoxicillin", "amoxicilline"]],
  ["Artéméther + luméfantrine", ["coartem", "artemether", "lumefantrine"]],
  ["Ibuprofène", ["ibuprofen", "ibuprofene"]],
  ["Amoxicilline + acide clavulanique", ["augmentin", "amoxicillin clavulanate", "amoxicilline acide clavulanique"]],
  ["Métronidazole", ["metronidazole", "metronidazole"]],
  ["Cotrimoxazole", ["cotrimoxazole", "trimethoprim sulfamethoxazole"]],
  ["Albendazole", ["albendazole", "zentel"]],
  ["Mébendazole", ["mebendazole", "vermox"]],
  ["Sels de réhydratation orale", ["oral rehydration salts", "ors", "sro"]],
  ["Diclofénac", ["diclofenac", "diclofenac"]],
  ["Oméprazole", ["omeprazole"]],
  ["Amlodipine", ["amlodipine"]],
  ["Cétirizine", ["cetirizine", "cetirizine"]],
  ["Azithromycine", ["azithromycin", "azithromycine"]],
  ["Ciprofloxacine", ["ciprofloxacin", "ciprofloxacine"]],
  ["Fer + acide folique", ["iron folic acid", "fer acide folique"]],
  ["Acide folique", ["folic acid", "acide folique"]],
  ["Quinine", ["quinine", "quinine"]],
  ["Artésunate + amodiaquine", ["artesunate amodiaquine", "artesunate-amodiaquine"]],
  ["Sulfadoxine + pyriméthamine", ["sulfadoxine pyrimethamine", "fansidar"]],
  ["Salbutamol", ["salbutamol", "albuterol"]],
  ["Metformine", ["metformin", "metformine"]],
  ["Loratadine", ["loratadine"]],
  ["Lopéramide", ["loperamide", "lopéramide"]],
  ["Paracétamol pédiatrique", ["paracetamol syrup", "paracetamol suspension"]],
];

const normalize = (s = "") => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (s) => normalize(s).split(/\s+/).filter((t) => t.length > 2 && !/^\d+$/.test(t));
const plain = (s = "") => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function rightsFor(info) {
  const meta = info.extmetadata ?? {};
  const short = plain(meta.LicenseShortName?.value ?? "");
  const terms = plain(meta.UsageTerms?.value ?? "");
  const licenseUrl = plain(meta.LicenseUrl?.value ?? "");
  if (!/^(CC0(?:\s|$)|Public domain(?:\s|$)|CC BY(?:-SA)?(?:\s|$))/i.test(short)) return null;
  if (/\b(?:NC|ND)\b/i.test(short + " " + terms)) return null;
  if (!licenseUrl && !/^Public domain/i.test(short) && !/^CC0/i.test(short)) return null;
  return {
    licence: [short, terms, licenseUrl].filter(Boolean).join(" — "),
    attribution: plain(meta.Artist?.value ?? meta.Credit?.value ?? "") || "Attribution non fournie par Wikimedia Commons",
  };
}

function matchesIdentity(query, title) {
  const wanted = tokens(query);
  const got = new Set(tokens(title.replace(/^File:/i, "")));
  if (!wanted.length) return false;
  const matched = wanted.filter((t) => got.has(t)).length;
  return matched / wanted.length >= 0.7 && wanted.some((t) => got.has(t));
}

async function searchCommons(query) {
  const params = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: "filetype:bitmap " + query + " medicine packaging box",
    gsrnamespace: "6", gsrlimit: "20", prop: "imageinfo", iiprop: "url|extmetadata",
    iiurlwidth: "640", format: "json", origin: "*",
  });
  const response = await fetch("https://commons.wikimedia.org/w/api.php?" + params, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Wikimedia Commons HTTP " + response.status);
  const json = await response.json();
  const pages = Object.values(json.query?.pages ?? {});
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl?.startsWith("https://") || !info?.descriptionurl?.startsWith("https://")) continue;
    if (!matchesIdentity(query, page.title ?? "")) continue;
    const rights = rightsFor(info);
    if (!rights) continue;
    return { title: page.title, imageUrl: info.thumburl, sourceUrl: info.descriptionurl, ...rights };
  }
  return null;
}

async function downloadImage(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("Téléchargement HTTP " + response.status);
  const mime = (response.headers.get("content-type") ?? "").split(";")[0].toLowerCase();
  const extByMime = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  if (!extByMime[mime]) throw new Error("Type d'image non pris en charge: " + mime);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error("Taille image invalide: " + buffer.length);
  return { buffer, mime, ext: extByMime[mime] };
}

async function loadCatalog() {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("medicaments_referentiel_sources")
.select("cis,nom,forme,substances_actives,photo_path,photo_source_url,photo_licence,photo_attribution,photo_verifiee_le")
      .order("nom").range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function localPopularity() {
  // Les recherches de l'app sont suivies pour les fiches locales, pas pour tout le
  // référentiel. On exploite donc les événements existants en priorité, sans prétendre
  // qu'ils constituent un classement exhaustif des 15 883 références.
  const since = new Date(Date.now() - 180 * 86400000).toISOString();
  const { data: events, error } = await supabase.from("recherche_events")
    .select("produit_id,created_at").gte("created_at", since).limit(10000);
  if (error) throw error;
  const counts = new Map();
  for (const event of events ?? []) counts.set(event.produit_id, (counts.get(event.produit_id) ?? 0) + 1);
  const ids = [...counts.keys()];
  if (!ids.length) return [];
  const { data: products, error: productError } = await supabase.from("produits")
    .select("id,nom,dci,forme").in("id", ids);
  if (productError) throw productError;
  return (products ?? []).map((p) => ({ ...p, searches: counts.get(p.id) ?? 0 })).sort((a, b) => b.searches - a.searches);
}

function priorityIndex(row) {
  const identity = normalize([row.nom, row.substances_actives, row.forme].filter(Boolean).join(" "));
  for (let i = 0; i < PRIORITY.length; i++) {
    if (PRIORITY[i][1].some((term) => identity.includes(normalize(term)))) return i;
  }
  return -1;
}

async function savePhoto(row, photo, dryRun) {
  // Le référentiel public est indexé par CIS; aucun CIP fictif ou enregistrement
  // image orphelin n'est créé. La licence et la provenance sont conservées sur la ligne CIS.
  const { data: current, error: lookupError } = await supabase.from("medicaments_referentiel_sources")
    .select("cis,photo_path,photo_source_url,photo_licence,photo_attribution,photo_verifiee_le")
    .eq("cis", row.cis).maybeSingle();
  if (lookupError) throw lookupError;
  if (!current) return { skipped: true, reason: "reference_CIS_absente" };
  if (current.photo_path && current.photo_source_url && current.photo_licence && current.photo_verifiee_le) {
    return { skipped: true, reason: "photo_deja_verifiee" };
  }

  const { buffer, mime, ext } = await downloadImage(photo.imageUrl);
  const safeCis = String(row.cis).replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = `cameroun/${safeCis}/reference.${ext}`;
  if (dryRun) return { path, bytes: buffer.length, mime };
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mime, upsert: true, cacheControl: "31536000",
  });
  if (uploadError) throw uploadError;

  const record = {
    photo_path: path,
    photo_source_url: photo.sourceUrl,
    photo_licence: photo.licence,
    photo_attribution: photo.attribution,
    photo_verifiee_le: new Date().toISOString(),
  };
  const { error } = await supabase.from("medicaments_referentiel_sources").update(record).eq("cis", row.cis);
  if (error) throw error;
  return { path, bytes: buffer.length, mime };
}

async function main() {
  console.log(`NAXA — photos catalogue Cameroun | limite=${LIMIT} | dry-run=${DRY_RUN}`);
  const [catalog, popularity] = await Promise.all([loadCatalog(), localPopularity()]);
  const seen = new Set();
  const candidates = [];
  // Fiches réellement recherchées (si les événements existent) passent avant le classement national.
  for (const p of popularity) {
    const match = catalog.find((r) => normalize(r.nom) === normalize(p.nom) || normalize(r.substances_actives).includes(normalize(p.dci)));
    if (match && !seen.has(match.cis)) { candidates.push({ ...match, priorityScore: 2000 + p.searches }); seen.add(match.cis); }
  }
  const perPriority = new Map();
  for (const row of catalog.map((r) => ({ ...r, priorityIndex: priorityIndex(r) }))
    .filter((r) => r.priorityIndex >= 0).sort((a, b) => a.priorityIndex - b.priorityIndex || a.nom.localeCompare(b.nom, "fr"))) {
    const used = perPriority.get(row.priorityIndex) ?? 0;
    // Évite de consommer tout le lot avec des milliers de présentations d’une seule DCI.
    if (used >= 2 || seen.has(row.cis)) continue;
    candidates.push(row);
    seen.add(row.cis);
    perPriority.set(row.priorityIndex, used + 1);
  }
  const report = { catalogue: catalog.length, candidates: candidates.length, attempted: 0, stored: 0, missing: 0, errors: 0, items: [] };
  for (const row of candidates.slice(0, LIMIT)) {
    report.attempted++;
    try {
      // Recherche prioritaire sur le nom complet et la substance active.
      const queries = [...new Set([row.nom, row.substances_actives].filter((s) => s && tokens(s).length > 0))].slice(0, 2);
      let photo = null;
      for (const query of queries) {
        try { photo = await searchCommons(query); } catch (error) { console.warn("Recherche source échouée:", row.nom, error.message); }
        if (photo) break;
        await delay(300);
      }
      if (!photo) {
        report.missing++;
        report.items.push({ cis: row.cis, nom: row.nom, result: "aucune_image_libre_correspondante" });
        console.log("SANS PHOTO", row.nom);
        continue;
      }
      const saved = await savePhoto(row, photo, DRY_RUN);
      if (saved.skipped) {
        report.items.push({ cis: row.cis, nom: row.nom, result: "deja_stockee" });
        console.log("DÉJÀ STOCKÉE", row.nom);
        continue;
      }
      report.stored++;
      report.items.push({ cis: row.cis, nom: row.nom, result: DRY_RUN ? "simulation" : "stockee", source: photo.sourceUrl, licence: photo.licence, ...saved });
      console.log(DRY_RUN ? "SIMULATION" : "STOCKÉE", row.nom, "=>", saved.path);
    } catch (error) {
      report.errors++;
      report.items.push({ cis: row.cis, nom: row.nom, result: "erreur", error: error.message });
      console.error("ERREUR", row.nom, error.message);
    }
    await delay(350);
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.errors) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exit(1); });

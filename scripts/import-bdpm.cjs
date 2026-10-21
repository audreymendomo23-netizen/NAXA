#!/usr/bin/env node
const { createClient } = require("@supabase/supabase-js");
const SOURCE_URL = "https://base-donnees-publique.medicaments.gouv.fr/telechargement";
const FILES = {
  specialties: "https://base-donnees-publique.medicaments.gouv.fr/download/file/CIS_bdpm.txt",
  compositions: "https://base-donnees-publique.medicaments.gouv.fr/download/file/CIS_COMPO_bdpm.txt"
};
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Missing Supabase URL or service-role key.");
  process.exit(1);
}
const requestedUpdatedAt = process.env.BDPM_UPDATED_AT || null;
if (requestedUpdatedAt && !/^\d{4}-\d{2}-\d{2}$/.test(requestedUpdatedAt)) {
  console.error("BDPM_UPDATED_AT must be YYYY-MM-DD.");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { "User-Agent": "NAXA-BDPM-import/1.0" } });
  if (!response.ok) throw new Error("Download failed (" + response.status + "): " + url);
  return response.text();
}
function rows(text) {
  return text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean).map((line) => line.split("\t"));
}
async function run() {
  const [specialtyText, compositionText, officialPage] = await Promise.all([
    download(FILES.specialties), download(FILES.compositions), download(SOURCE_URL)
  ]);
  const dateMatch = officialPage.match(/Dernière mise à jour\s+le\s+(\d{2})\/(\d{2})\/(\d{4})/i);
  const updatedAt = requestedUpdatedAt || (dateMatch ? dateMatch[3] + "-" + dateMatch[2] + "-" + dateMatch[1] : null);
  if (!updatedAt) console.warn("Date officielle BDPM introuvable; la date sera laissée NULL.");
  const activeByCis = new Map();
  for (const row of rows(compositionText)) {
    const cis = String(row[0] || "").trim();
    const substance = String(row[3] || "").trim();
    const nature = String(row[6] || "").trim().toUpperCase();
    if (!cis || !substance || (nature && nature !== "SA" && !nature.includes("SUBSTANCE ACTIVE"))) continue;
    if (!activeByCis.has(cis)) activeByCis.set(cis, new Set());
    activeByCis.get(cis).add(substance);
  }
  const records = [];
  for (const row of rows(specialtyText)) {
    const cis = String(row[0] || "").trim();
    const nom = String(row[1] || "").trim();
    if (!cis || !nom) continue;
    records.push({
      cis, nom, forme: row[2] || null, voies_administration: row[3] || null,
      statut_amm: row[4] || null, etat_commercialisation: row[6] || null,
      date_amm: row[7] || null, titulaires: row[10] || null,
      substances_actives: [...(activeByCis.get(cis) || [])].join("; ") || null,
      source_nom: "Base de données publique des médicaments (BDPM)",
      source_url: SOURCE_URL, source_dataset_updated_at: updatedAt,
      imported_at: new Date().toISOString(),
      raw_record: { cis: row[0], nom: row[1], forme: row[2], voies: row[3], statutAmm: row[4], typeProcedure: row[5], commercialisation: row[6], dateAmm: row[7], statutBdm: row[8], numeroAmmEuropeen: row[9], titulaires: row[10], surveillanceRenforcee: row[11] }
    });
  }
  if (!records.length) throw new Error("No valid BDPM specialty rows parsed; refusing to alter the table.");
  let imported = 0;
  for (let offset = 0; offset < records.length; offset += 400) {
    const batch = records.slice(offset, offset + 400);
    const { error } = await supabase.from("medicaments_referentiel_sources").upsert(batch, { onConflict: "cis" });
    if (error) throw new Error("Supabase batch " + offset + " failed: " + error.message);
    imported += batch.length;
  }
  console.log(JSON.stringify({ source: SOURCE_URL, sourceDatasetUpdatedAt: updatedAt, downloadedRows: rows(specialtyText).length, imported, note: "Le référentiel français ne vaut pas autorisation au Cameroun." }, null, 2));
}
run().catch((error) => { console.error(error.message || error); process.exitCode = 1; });

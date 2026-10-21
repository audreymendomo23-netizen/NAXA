#!/usr/bin/env node
/* Import officiel BDPM vers une table de référence séparée du catalogue commercial NAXA.
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-bdpm.cjs
 * Optionnel: BDPM_UPDATED_AT=YYYY-MM-DD (date officielle visible sur la page BDPM).
 */
const { createClient } = require("@supabase/supabase-js");

const SOURCE_URL = "https://base-donnees-publique.medicaments.gouv.fr/telechargement";
const FILES = {
  specialties: "https://base-donnees-publique.medicaments.gouv.fr/download/file/CIS_bdpm.txt",
  compositions: "https://base-donnees-publique.medicaments.gouv.fr/download/file/CIS_COMPO_bdpm.txt"
};
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const updatedAt = process.env.BDPM_UPDATED_AT || null;
if (updatedAt && !/^\d{4}-\d{2}-\d{2}$/.test(updatedAt)) {
  console.error("BDPM_UPDATED_AT must be YYYY-MM-DD, or omitted when the official date is not confirmed.");
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
function normalizeCis(value) { return String(value || "").trim(); }
function main() { return run().catch((error) => { console.error(error.message || error); process.exitCode = 1; }); }
async function run() {
  const [specialtyText, compositionText] = await Promise.all([download(FILES.specialties), download(FILES.compositions)]);
  const activeByCis = new Map();
  for (const row of rows(compositionText)) {
    const cis = normalizeCis(row[0]);
    const substance = String(row[3] || "").trim();
    const nature = String(row[6] || "").trim().toUpperCase();
    if (!cis || !substance || (nature && !nature.includes("SA"))) continue;
    if (!activeByCis.has(cis)) activeByCis.set(cis, new Set());
    activeByCis.get(cis).add(substance);
  }
  const records = [];
  for (const row of rows(specialtyText)) {
    const cis = normalizeCis(row[0]);
    const nom = String(row[1] || "").trim();
    if (!cis || !nom) continue;
    records.push({
      cis, nom, forme: row[2] || null, voies_administration: row[3] || null,
      statut_amm: row[4] || null, etat_commercialisation: row[6] || null,
      date_amm: row[7] || null, titulaires: row[10] || null,
      substances_actives: [...(activeByCis.get(cis) || [])].join("; ") || null,
      source_nom: "Base de données publique des médicaments (BDPM)",
      source_url: SOURCE_URL, source_dataset_updated_at: updatedAt,
      imported_at: new Date().toISOString(), raw_record: { cis: row[0], nom: row[1], forme: row[2], voies: row[3], statutAmm: row[4], typeProcedure: row[5], commercialisation: row[6], dateAmm: row[7], statutBdm: row[8], numeroAmmEuropeen: row[9], titulaires: row[10], surveillanceRenforcee: row[11] }
    });
  }
  if (!records.length) throw new Error("BDPM files downloaded but no valid specialty rows were parsed; refusing to alter the table.");
  let imported = 0;
  for (let offset = 0; offset < records.length; offset += 400) {
    const batch = records.slice(offset, offset + 400);
    const { error } = await supabase.from("medicaments_referentiel_sources").upsert(batch, { onConflict: "cis" });
    if (error) throw new Error("Supabase batch " + offset + " failed: " + error.message);
    imported += batch.length;
  }
  console.log(JSON.stringify({
    source: SOURCE_URL, sourceDatasetUpdatedAt: updatedAt,
    downloadedRows: rows(specialtyText).length, imported,
    note: "La date du jeu reste NULL si BDPM_UPDATED_AT n’a pas été confirmé. Import non assimilé à une autorisation au Cameroun."
  }, null, 2));
}
main();

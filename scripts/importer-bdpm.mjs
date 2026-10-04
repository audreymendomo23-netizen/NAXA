// Prépare un CSV à partir de la BDPM.
import { readFileSync } from "node:fs";

const [, , fichierSpecialites, fichierCompo] = process.argv;
if (!fichierSpecialites || !fichierCompo) {
  console.error("Usage : node scripts/importer-bdpm.mjs CIS_bdpm.txt CIS_COMPO_bdpm.txt > produits_bdpm.csv");
  process.exit(1);
}
const lire = (f) => new TextDecoder("windows-1252").decode(readFileSync(f)).split(/\r?\n/).filter(Boolean).map((l) => l.split("\t"));
const compo = new Map();
for (const c of lire(fichierCompo)) {
  const [cis, , , substance, dosage, , nature] = c;
  if (nature !== "SA") continue;
  const e = compo.get(cis) ?? { dci: [], dosage: [] };
  if (substance && !e.dci.includes(substance)) e.dci.push(substance);
  if (dosage) e.dosage.push(dosage);
  compo.set(cis, e);
}
const csv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const vus = new Set();
console.log("nom,dci,dosage,forme,bdpm_cis");
for (const s of lire(fichierSpecialites)) {
  const [cis, denomination, forme, , , , commercialisation] = s;
  if (!/commercialis/i.test(commercialisation ?? "") || /non commercialis/i.test(commercialisation ?? "")) continue;
  const nom = denomination.split(",")[0].trim();
  const c = compo.get(cis) ?? { dci: [], dosage: [] };
  const dci = c.dci.join(" + ").toLowerCase();
  const dosage = c.dosage.join(" + ");
  const cle = `${nom}|${dosage}|${forme}`;
  if (vus.has(cle)) continue;
  vus.add(cle);
  console.log([nom, dci, dosage, forme, cis].map(csv).join(","));
}

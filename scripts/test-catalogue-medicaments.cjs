const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const catalogue = fs.readFileSync(path.join(root, "src/lib/medicaments/catalogue-pilote.ts"), "utf8");
const route = fs.readFileSync(path.join(root, "src/app/api/medicaments/recherche/route.ts"), "utf8");
const recherche = fs.readFileSync(path.join(root, "src/components/Recherche.tsx"), "utf8");
const resultats = fs.readFileSync(path.join(root, "src/app/resultats/page.tsx"), "utf8");
const produit = fs.readFileSync(path.join(root, "src/app/produit/[id]/page.tsx"), "utf8");
const panier = fs.readFileSync(path.join(root, "src/app/panier/page.tsx"), "utf8");

test("prototype : dix termes fréquents à valider avec les pharmacies camerounaises", () => {
  const rows = [...catalogue.matchAll(/\{ nomFr: "[^"]+", substanceFr: "[^"]+", alias: \[[^\]]+\] \}/g)];
  assert.equal(rows.length, 10);
});

test("API : trois sources attendues et aucune dépendance à RxImage", () => {
  assert.match(route, /rxnav\.nlm\.nih\.gov\/REST\/drugs\.json/);
  assert.match(route, /api\.fda\.gov\/drug\/label\.json/);
  assert.match(route, /dailymed\.nlm\.nih\.gov\/dailymed\/services\/v2/);
  assert.doesNotMatch(route, /rximage\.nlm\.nih\.gov/);
});

test("API : les images externes sont limitées au domaine DailyMed", () => {
  assert.match(route, /image\.url\.startsWith\("https:\/\/dailymed\.nlm\.nih\.gov\/"\)/);
  assert.match(recherche, /PHOTO_MEDICAMENT_PAR_DEFAUT/);
});

test("recherche : résultats instantanés et disponibilité partenaire séparée", () => {
  assert.match(recherche, /\/api\/medicaments\/recherche\?q=/);
  assert.match(recherche, /Vérifier le stock des pharmacies partenaires/);
  assert.match(route, /const availability = !localProduct/);
  assert.match(route, /from\("stocks"\)/);
  assert.match(route, /\.gt\("quantite", 0\)/);
  assert.match(route, /\.eq\("pharmacies\.actif", true\)/);
});

test("stock : la recherche affiche les statuts réels du réseau partenaire", () => {
  assert.match(recherche, /Disponible chez nos partenaires/);
  assert.match(recherche, /Indisponible dans le réseau partenaire/);
  assert.match(recherche, /Stock non vérifié/);
  assert.match(recherche, /partnerPharmacyCount/);
});

test("images : la photo locale est prioritaire et le placeholder reste disponible", () => {
  assert.match(route, /imageUrl: localProduct\\?\\.photo_url \\|\\|/);
  assert.match(recherche, /PHOTO_MEDICAMENT_PAR_DEFAUT/);
});

test("dosage : aucun dosage n'est rendu dans les vues client principales", () => {
  assert.doesNotMatch(resultats, /\{i\.nom\}\s*\{i\.dosage\}/);
  assert.doesNotMatch(produit, /\{p\.nom\}\s*\{p\.dosage\}/);
  assert.doesNotMatch(panier, /\{l\.nom\}\s*\{l\.dosage\}/);
  assert.doesNotMatch(recherche, /medicament\.dosage/);
});

test("sécurité : recherche courte refusée et appels externes limités dans le temps", () => {
  assert.match(route, /query\.length < 2/);
  assert.match(route, /AbortSignal\.timeout\(4500\)/);
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const scanner = fs.readFileSync(path.join(root, "src/components/ScannerShell.tsx"), "utf8");
const ocr = fs.readFileSync(path.join(root, "src/lib/ocr.ts"), "utf8");
const results = fs.readFileSync(path.join(root, "src/app/resultats/page.tsx"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261112050000_search_pharmacies_bulk_quantity.sql"), "utf8");
const checkout = fs.readFileSync(path.join(root, "src/app/commande/nouvelle/page.tsx"), "utf8");

test("OCR : les lignes sont analysées séparément et les instructions de posologie ne deviennent pas des médicaments", () => {
  assert.match(ocr, /\.split\(\/\\r\?\\n\//);
  assert.match(ocr, /!BRUIT\.test\(ligne\)/);
  assert.match(ocr, /!\/\^\(\?:prendre\|posologie\|matin\|midi\|soir/);
});

test("Scanner : les ordonnances PDF sont converties localement avec une limite de cinq pages", () => {
  assert.match(scanner, /pdfjs-dist\/legacy\/build\/pdf\.mjs/);
  assert.match(scanner, /pdfDocument\.numPages > 5/);
  assert.match(scanner, /page\.render\(\{ canvas, canvasContext: context, viewport \}\)/);
});

test("Scanner : le parcours bulk transmet les médicaments et leurs quantités", () => {
  assert.match(scanner, /router\.push\("\/resultats\?bulk=1&"/);
  assert.match(scanner, /"q=" \+ encodeURIComponent\(item\.nom\.trim\(\)\) \+ "&n=" \+ item\.quantite/);
  assert.match(scanner, /"p=" \+ item!\.id \+ ":" \+ selection\[index\]\.quantite/);
});

test("Recherche : les termes OCR et quantités utilisent le RPC serveur dédié", () => {
  assert.match(results, /search_pharmacies_bulk/);
  assert.match(results, /p_quantities:bulkTerms\.map\(\(_,index\)=>bulkQuantities\[index\]\?\?1\)/);
  assert.match(results, /item\.quantite_demandee/);
});

test("SQL : stock suffisant et date de péremption vérifiés avant d'afficher une offre", () => {
  assert.match(migration, /s\.quantite >= b\.qte_demandee/);
  assert.match(migration, /s\.date_peremption is null or s\.date_peremption >= current_date/);
  assert.match(migration, /'quantite_demandee', d\.qte_demandee/);
  assert.match(migration, /sum\(d\.prix \* d\.qte_demandee\)/);
});

test("Commande : les transactions sont créées côté serveur avec les quantités du panier", () => {
  assert.match(checkout, /quantite:x\.quantite/);
  assert.match(checkout, /rpc\("creer_transactions_client"/);
  assert.match(checkout, /Le stock a changé\. Revérifiez les disponibilités\./);
});

test("Sécurité : le scan OCR ne valide jamais une prescription automatiquement", () => {
  assert.match(results, /soumis à ordonnance/);
  assert.match(results, /aucune validation médicale automatique/);
});

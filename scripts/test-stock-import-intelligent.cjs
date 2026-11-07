const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "src/lib/importStock.ts"), "utf8");
const wizard = fs.readFileSync(path.join(root, "src/components/pharmacie/ImportStockIntelligent.tsx"), "utf8");
const workspace = fs.readFileSync(path.join(root, "src/components/pharmacie/GestionnaireStockEspace.tsx"), "utf8");
const mappingApi = fs.readFileSync(path.join(root, "src/app/api/pharmacie/gestionnaire-stock/import/mapping/route.ts"), "utf8");
const applyApi = fs.readFileSync(path.join(root, "src/app/api/pharmacie/gestionnaire-stock/import/apply/route.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261107210000_stock_import_intelligent_rpc.sql"), "utf8");

test("import adaptatif : vocabulaire français/anglais et colonnes de logiciels hétérogènes", () => {
  for (const token of ["designation","libelle","active ingredient","ean13","pvttc","stock final","batch number","date peremption","emplacement"]) {
    assert.ok(engine.toLowerCase().includes(token), "Alias absent : " + token);
  }
  assert.match(engine, /normaliserColonneStock/);
  assert.match(engine, /suggererColonnesStock/);
});

test("import adaptatif : détection d'en-têtes décalés et parsing multi-feuilles", () => {
  assert.match(engine, /detecterLigneEntete/);
  assert.match(wizard, /workbook\.SheetNames/);
  assert.match(wizard, /sheet_to_json/);
  assert.match(wizard, /detecterLigneEntete/);
  assert.match(wizard, /headerRow/);
  assert.match(wizard, /Fichier trop volumineux/);
});

test("mapping IA : Gemini/Groq côté serveur, colonnes autorisées et sortie contrôlée", () => {
  assert.match(mappingApi, /GEMINI_API_KEY/);
  assert.match(mappingApi, /GOOGLE_GEMINI_API_KEY/);
  assert.match(mappingApi, /GROQ_API_KEY/);
  assert.match(mappingApi, /generativelanguage\.googleapis\.com/);
  assert.match(mappingApi, /api\.groq\.com/);
  assert.match(mappingApi, /sanitizeMapping/);
  assert.match(mappingApi, /authorized\(pharmacieId\)/);
  assert.match(mappingApi, /IMPORT_STOCK/);
  assert.match(mappingApi, /donnée privée masquée/);
});

test("rapprochement catalogue : code-barres, nom/DCI/dosage et correction humaine", () => {
  assert.match(engine, /scoreRapprochementProduit/);
  assert.match(engine, /code_barre/);
  assert.match(wizard, /topMatches/);
  assert.match(wizard, /À rapprocher/);
  assert.match(wizard, /onChange=\{event=>setOverrides/);
  assert.match(wizard, /Produits? catalogue NAXA/);
});

test("aperçu obligatoire et snapshot déclaré avant les écritures", () => {
  assert.match(wizard, /Correspondance des colonnes/);
  assert.match(wizard, /Lignes candidates/);
  assert.match(wizard, /À corriger \/ rapprocher/);
  assert.match(wizard, /Je confirme qu’il s’agit d’un inventaire total/);
  assert.match(wizard, /disabled=\{!canImport\}/);
  assert.match(wizard, /import\/apply/);
  assert.match(workspace, /ImportStockIntelligent/);
});

test("écriture stock : identité active, pharmacie autorisée et privilège IMPORT_STOCK", () => {
  assert.match(applyApi, /auth\.getUser\(\)/);
  assert.match(applyApi, /profile\?\.actif!==true/);
  assert.match(applyApi, /naxa_has_privilege/);
  assert.match(applyApi, /IMPORT_STOCK/);
  assert.match(applyApi, /naxa_import_stock_batch/);
  assert.doesNotMatch(engine, /supabaseBrowser/);
  assert.doesNotMatch(engine, /\.from\("stocks"\)\.upsert/);
});

test("RPC stock : transaction privilégiée, validation des données et garde FEFO", () => {
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = ''/i);
  assert.match(migration, /naxa_scope_allows/);
  assert.match(migration, /naxa_has_privilege\('IMPORT_STOCK'/);
  assert.match(migration, /revoke all on function public\.naxa_import_stock_batch\(uuid,jsonb\) from public,anon/i);
  assert.match(migration, /grant execute on function public\.naxa_import_stock_batch\(uuid,jsonb\) to authenticated/i);
  assert.match(migration, /Produit déjà suivi par lots/);
  assert.match(migration, /stocks_lots/);
  assert.match(migration, /on conflict \(pharmacie_id,produit_id\) do update/);
});

test("lignes non interprétables : aucune quantité ou prix inventé", () => {
  assert.match(engine, /parserNombreStock/);
  assert.match(engine, /return Number\.isFinite\(parsed\) \? parsed : null/);
  assert.match(engine, /validerLigneImportStock/);
  assert.match(applyApi, /Number\.isSafeInteger\(quantite\)/);
  assert.match(applyApi, /prix de vente invalide/);
});

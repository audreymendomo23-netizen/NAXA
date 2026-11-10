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
const matchApi = fs.readFileSync(path.join(root, "src/app/api/pharmacie/gestionnaire-stock/import/match/route.ts"), "utf8");
const ts = require("typescript");
const compiledEngine = ts.transpileModule(engine, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const engineModule = { exports: {} };
new Function("module", "exports", compiledEngine.outputText)(engineModule, engineModule.exports);
const stockEngine = engineModule.exports;
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261107210000_stock_import_intelligent_rpc.sql"), "utf8");
const purchaseCostMigration = fs.readFileSync(path.join(root, "supabase/migrations/20261107220000_stock_import_purchase_cost.sql"), "utf8");

test("import adaptatif : vocabulaire français/anglais et colonnes de logiciels hétérogènes", () => {
  for (const token of ["designation","libelle","active ingredient","ean13","pvttc","prix achat","purchase price","stock final","batch number","date peremption","emplacement"]) {
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
  assert.match(mappingApi, /purchaseCost/);
  assert.match(mappingApi, /cout achat/);
});

test("rapprochement catalogue : code-barres, nom/DCI/dosage et correction humaine", () => {
  assert.match(engine, /scoreRapprochementProduit/);
  assert.match(engine, /code_barre/);
  assert.match(wizard, /topMatches/);
  assert.match(wizard, /À rapprocher/);
  assert.match(wizard, /onChange=\{event=>\{setOverrides/);
  assert.match(wizard, /Produits? catalogue NAXA/);
});

test("aperçu obligatoire et snapshot déclaré avant les écritures", () => {
  assert.match(wizard, /Correspondance des colonnes/);
  assert.match(wizard, /Lignes candidates/);
  assert.match(wizard, /À corriger \/ rapprocher/);
  assert.match(wizard, /Je confirme qu’il s’agit d’un instantané de stock fiable/);
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
  assert.match(purchaseCostMigration, /stocks_couts/);
  assert.match(purchaseCostMigration, /EDIT_STOCK_PARAMETERS/);
  assert.match(purchaseCostMigration, /cout_achat/);
  assert.match(migration, /on conflict \(pharmacie_id,produit_id\) do update/);
});

test("lignes non interprétables : aucune quantité ou prix inventé", () => {
  assert.match(engine, /parserNombreStock/);
  assert.match(engine, /return Number\.isFinite\(parsed\) \? parsed : null/);
  assert.match(engine, /validerLigneImportStock/);
  assert.match(applyApi, /Number\.isSafeInteger\(quantite\)/);
  assert.match(applyApi, /prix de vente invalide/);
});

test("suggestions IA : API authentifiée, candidats limités au catalogue et sorties filtrées", () => {
  assert.match(matchApi, /auth\\.getUser\\(\\)/);
  assert.match(matchApi, /naxa_has_privilege/);
  assert.match(matchApi, /from\\("produits"\\)/);
  assert.match(matchApi, /allowedByRow/);
  assert.match(matchApi, /allowed\\?\\.has\\(productId\\)/);
  assert.match(matchApi, /GEMINI_API_KEY/);
  assert.match(matchApi, /GROQ_API_KEY/);
  assert.doesNotMatch(matchApi, /naxa_import_stock_batch/);
  assert.match(wizard, /Utiliser cette proposition/);
  assert.match(wizard, /aucune n’est sélectionnée automatiquement/);
  assert.match(wizard, /verifierCorrespondanceIA/);
  assert.match(wizard, /const checkedSuggestion=/);
});

test("vérificateur déterministe : accepte une identité compatible et un code-barres exact", () => {
  const row = { name: "Doliprane", dci: "paracétamol", dosage: "500 mg", form: "CP", barcode: "3400930000001" };
  const product = { id: "p1", nom: "Paracétamol", dci: "paracetamol", dosage: "500mg", forme: "comprimé", code_barre: "3400930000001" };
  const result = stockEngine.verifierCorrespondanceIA(row, product);
  assert.equal(result.accepted, true);
  assert.equal(result.score, 1);
});

test("vérificateur déterministe : rejette un code-barres contradictoire", () => {
  const row = { name: "Paracétamol", barcode: "3400930000001" };
  const product = { id: "p2", nom: "Paracétamol", code_barre: "3400930000002" };
  const result = stockEngine.verifierCorrespondanceIA(row, product);
  assert.equal(result.accepted, false);
  assert.match(result.reason, /Code-barres incompatible/);
});

test("vérificateur déterministe : rejette un dosage contradictoire même si l'IA le propose", () => {
  const row = { name: "Paracétamol", dci: "paracetamol", dosage: "500 mg", form: "comprimé" };
  const product = { id: "p3", nom: "Paracétamol", dci: "paracetamol", dosage: "250 mg", forme: "comprimé" };
  const result = stockEngine.verifierCorrespondanceIA(row, product);
  assert.equal(result.accepted, false);
  assert.match(result.reason, /Dosage incompatible/);
});

test("vérificateur déterministe : rejette une DCI ou une forme incompatible", () => {
  const dci = stockEngine.verifierCorrespondanceIA(
    { name: "Paracétamol", dci: "paracetamol", dosage: "500mg", form: "comprimé" },
    { id: "p4", nom: "Paracétamol", dci: "ibuprofene", dosage: "500mg", forme: "comprimé" }
  );
  const form = stockEngine.verifierCorrespondanceIA(
    { name: "Paracétamol", dci: "paracetamol", dosage: "500mg", form: "sirop" },
    { id: "p5", nom: "Paracétamol", dci: "paracetamol", dosage: "500mg", forme: "comprimé" }
  );
  assert.equal(dci.accepted, false);
  assert.match(dci.reason, /Principe actif \\(DCI\\) incompatible/);
  assert.equal(form.accepted, false);
  assert.match(form.reason, /Forme pharmaceutique incompatible/);
});

test("vérificateur déterministe : refuse une suggestion trop faible", () => {
  const result = stockEngine.verifierCorrespondanceIA(
    { name: "Molécule inconnue 77" },
    { id: "p6", nom: "Paracétamol" }
  );
  assert.equal(result.accepted, false);
  assert.match(result.reason, /insuffisamment étayée/);
});

test("vérificateur déterministe : normalise les unités microgrammes équivalentes", () => {
  const result = stockEngine.verifierCorrespondanceIA(
    { name: "Vitamine D", dosage: "50 µg", form: "comprimé" },
    { id: "p7", nom: "Vitamine D", dosage: "50 mcg", forme: "comprimé" }
  );
  assert.equal(result.accepted, true);
});

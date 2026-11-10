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
const rpcGuardMigration = fs.readFileSync(path.join(root, "supabase/migrations/20261110013000_stock_import_rpc_service_role_guard.sql"), "utf8");
const rpcGuardTest = fs.readFileSync(path.join(root, "supabase/tests/stock_import_rpc_service_role_guard.sql"), "utf8");

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
  assert.match(mappingApi, /Gemini_API_Key/);
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
  assert.match(applyApi, /naxa_import_stock_batch_as_actor/);
  assert.match(applyApi, /supabaseAdmin\(\)/);
  assert.doesNotMatch(applyApi, /sb\.rpc\("naxa_import_stock_batch"/);
  assert.match(applyApi, /verifierCorrespondanceIA/);
  assert.match(applyApi, /EDIT_STOCK_PARAMETERS|naxa_has_privilege/);
  assert.match(applyApi, /from\("produits"\)/);
  assert.match(applyApi, /L’identité de certains produits/);
  assert.match(applyApi, /requireScore:false/);
  assert.match(applyApi, /select\("id,nom,dci,dosage,forme,code_barre,conditionnement"\)/);
  assert.match(wizard, /dci:row.dci,dosage:row.dosage,form:row.form,barcode:row.barcode/);
  assert.match(wizard, /selectedProduct/);
  assert.match(wizard, /requireScore:false/);
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
  assert.match(rpcGuardMigration, /naxa_import_stock_batch_as_actor/);
  assert.match(rpcGuardMigration, /request\.jwt\.claim\.role/);
  assert.match(rpcGuardMigration, /set_config\(\x27request\.jwt\.claim\.sub\x27/);
  assert.match(rpcGuardMigration, /revoke all on function public\.naxa_import_stock_batch\(uuid,jsonb\)[\s\S]*from public, anon, authenticated, service_role/i);
  assert.match(rpcGuardMigration, /grant execute on function public\.naxa_import_stock_batch_as_actor\(uuid,uuid,jsonb\)[\s\S]*to service_role/i);
  assert.doesNotMatch(rpcGuardMigration, /grant execute[\s\S]*to authenticated/i);
  assert.match(rpcGuardTest, /has_function_privilege/);
  assert.match(rpcGuardTest, /ROLLBACK/i);
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
  assert.ok(matchApi.includes("auth.getUser()"));
  assert.ok(matchApi.includes("naxa_has_privilege"));
  assert.ok(matchApi.includes('.from("produits")'));
  assert.ok(matchApi.includes("allowedByRow"));
  assert.ok(matchApi.includes("allowed?.has(productId)"));
  assert.match(matchApi, /GEMINI_API_KEY/);
  assert.match(matchApi, /Gemini_API_Key/);
  assert.match(matchApi, /GROQ_API_KEY/);
  assert.doesNotMatch(matchApi, /naxa_import_stock_batch/);
  assert.match(wizard, /Utiliser cette proposition/);
  assert.match(wizard, /aucune n’est sélectionnée automatiquement/);
  assert.match(wizard, /verifierCorrespondanceIA/);
  assert.match(wizard, /const checkedSuggestion=/);
});

test("RPC de sécurité : le serveur est le seul chemin de mutation, et la recette SQL est transactionnelle", () => {
  assert.match(rpcGuardMigration, /security definer/i);
  assert.match(rpcGuardMigration, /service_role/i);
  assert.match(applyApi, /supabaseAdmin\(\)/);
  assert.match(applyApi, /p_actor:user\.id/);
  assert.match(rpcGuardTest, /rollback/i);
  assert.match(rpcGuardTest, /service_role/i);
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
  assert.match(result.reason, /Code-barres absent du catalogue ou incompatible/);
});

test("vérificateur déterministe : rejette un dosage contradictoire même si l'IA le propose", () => {
  const row = { name: "Paracétamol", dci: "paracetamol", dosage: "500 mg", form: "comprimé" };
  const product = { id: "p3", nom: "Paracétamol", dci: "paracetamol", dosage: "250 mg", forme: "comprimé" };
  const result = stockEngine.verifierCorrespondanceIA(row, product);
  assert.equal(result.accepted, false);
  assert.match(result.reason, /Dosage absent ou incompatible/);
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
  assert.equal(dci.reason, "Principe actif (DCI) absent ou incompatible.");
  assert.equal(form.accepted, false);
  assert.match(form.reason, /Forme pharmaceutique absente ou incompatible/);
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

test("vérificateur déterministe : refuse une fiche catalogue incomplète si la source fournit une DCI", () => {
  const result = stockEngine.verifierCorrespondanceIA(
    { name: "Paracétamol", dci: "paracetamol" },
    { id: "p8", nom: "Paracétamol", dci: null },
    { requireScore: false }
  );
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "Principe actif (DCI) absent ou incompatible.");
});

test("sélection manuelle : autorise le faible score seulement sans contradiction vérifiable", () => {
  const result = stockEngine.verifierCorrespondanceIA(
    { name: "Nom fournisseur peu ressemblant" },
    { id: "p9", nom: "Paracétamol" },
    { requireScore: false }
  );
  assert.equal(result.accepted, true);
});

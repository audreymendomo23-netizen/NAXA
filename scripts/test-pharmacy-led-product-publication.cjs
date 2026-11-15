"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const action = fs.readFileSync(path.join(root, "src/app/pharmacie/gestionnaire-stock/actions.ts"), "utf8");
const workspace = fs.readFileSync(path.join(root, "src/components/pharmacie/GestionnaireStockEspace.tsx"), "utf8");
const searchApi = fs.readFileSync(path.join(root, "src/app/api/medicaments/recherche/route.ts"), "utf8");
const offlineApi = fs.readFileSync(path.join(root, "src/app/api/medicaments/catalogue-hors-ligne/route.ts"), "utf8");
const searchUi = fs.readFileSync(path.join(root, "src/components/Recherche.tsx"), "utf8");
const productPage = fs.readFileSync(path.join(root, "src/app/produit/[id]/page.tsx"), "utf8");
const offerPage = fs.readFileSync(path.join(root, "src/app/offre/[pharmacieId]/[produitId]/page.tsx"), "utf8");

test("le gestionnaire Stock peut déclarer une référence absente du catalogue", () => {
  assert.match(workspace, /Déclarer un produit absent du catalogue/);
  assert.match(workspace, /NAXA ne valide ni n’approuve la fiche/);
  assert.match(workspace, /name="nom"/);
  assert.match(workspace, /name="dci"/);
  assert.match(workspace, /name="dosage"/);
  assert.match(workspace, /name="forme"/);
  assert.match(workspace, /name="prix"/);
  assert.match(workspace, /name="sur_ordonnance"/);
  assert.match(workspace, /action=\{declarerProduitEtInitialiserReferenceStock\}/);
  assert.match(workspace, /"promoteur","pharmacie","pharmacien"/);
});

test("l'action utilise la RPC atomique et ne crée pas de quantité vendable", () => {
  assert.match(action, /export async function declarerProduitEtInitialiserReferenceStock/);
  assert.match(action, /pharmacie_produit_declarer_et_reference_initialiser/);
  assert.match(action, /safeUuid\(pharmacie\)/);
  assert.match(action, /revalidatePath\("\/pharmacie\/gestionnaire-stock\/stock-logistique"\)/);
  assert.match(workspace, /initialisée à quantité zéro/);
  assert.match(workspace, /réception réelle avec lot et péremption/);
});

test("la recherche client ne filtre plus les produits par validation NAXA", () => {
  for (const [name, source] of [
    ["recherche API", searchApi], ["catalogue hors ligne", offlineApi],
    ["recherche UI", searchUi], ["fiche produit", productPage], ["offre pharmacie", offerPage]
  ]) {
    assert.doesNotMatch(source, /fiche_validee|localInformationValidated|Fiche locale validée par NAXA/, name);
  }
  assert.match(searchUi, /NAXA ne certifie pas cette fiche/);
  assert.match(offerPage, /Stock communiqué comme disponible/);
});

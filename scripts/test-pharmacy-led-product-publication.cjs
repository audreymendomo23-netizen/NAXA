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
const productIdentityMigration = fs.readFileSync(path.join(root, "supabase/migrations/20261115110000_pharmacy_product_identity_scoped_by_pharmacy.sql"), "utf8");
const productIdentitySqlTest = fs.readFileSync(path.join(root, "supabase/tests/20261115110000_pharmacy_product_identity_scoped_by_pharmacy.sql"), "utf8");

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


test("chaque pharmacie peut modifier ses propres fiches sans pouvoir modifier celle d'une autre pharmacie", () => {
  assert.match(action, /export async function modifierFicheProduitPharmacie/);
  assert.match(action, /naxa_business_function/);
  assert.match(action, /"promoteur","pharmacie","pharmacien","pharmacien_assistant","responsable","gestionnaire_stock","magasinier"/);
  assert.match(action, /\.from\("produits"\)\.update\(/);
  assert.match(action, /\.eq\("created_by_pharmacie_id", pharmacie\)/);
  assert.match(action, /erreur=modification_fiche/);
  assert.doesNotMatch(action.slice(action.indexOf("export async function modifierFicheProduitPharmacie")), /fiche_validee\s*:/);
});

test("l'espace Stock expose seulement les fiches appartenant au périmètre pharmacie actif", () => {
  assert.match(workspace, /created_by_pharmacie_id/);
  assert.match(workspace, /ids\.includes\(product\.created_by_pharmacie_id as string\)/);
  assert.match(workspace, /Modifier mes fiches produits/);
  assert.match(workspace, /action=\{modifierFicheProduitPharmacie\}/);
  for (const field of ["nom","dci","dosage","forme","code_barre","conditionnement","description","indications","precautions","fabricant","sur_ordonnance"]) {
    assert.match(workspace, new RegExp('name="' + field + '"'));
  }
  assert.match(workspace, /NAXA ne relit ni n’approuve ces changements/);
  assert.match(workspace, /fonction!=="admin"/);
});



test("deux pharmacies gardent des fiches distinctes pour un même médicament", () => {
  assert.match(productIdentityMigration, /drop constraint if exists produits_nom_dosage_forme_key/i);
  assert.match(productIdentityMigration, /drop index if exists public\.produits_code_barre_uq/i);
  assert.match(productIdentityMigration, /create unique index produits_pharmacy_identity_uq/i);
  assert.match(productIdentityMigration, /create unique index produits_pharmacy_barcode_uq/i);
  assert.match(productIdentityMigration, /where p\.created_by_pharmacie_id=p_pharmacie/i);
  assert.match(productIdentityMigration, /pg_advisory_xact_lock/i);
  assert.match(productIdentityMigration, /v_owner is not null and v_owner is distinct from p_pharmacie/i);
  assert.match(productIdentityMigration, /Ce code-barres est déjà utilisé par une autre fiche de votre pharmacie/);
});

test("l'espace Stock ne propose que le catalogue historique partagé et les fiches de son réseau", () => {
  assert.match(workspace, /\.or\("created_by_pharmacie_id\.is\.null,created_by_pharmacie_id\.in\.\("\+ids\.join\(","\)\+"\)"\)/);
  assert.match(workspace, /fonction!=="admin"&&<><ImportStockIntelligent/);
  assert.match(workspace, /fonction!=="admin"&&<section className="space-y-3 rounded-2xl border bg-white p-4">/);
});

test("l'Administrateur reste en lecture seule et la recherche conserve une identité par pharmacie", () => {
  assert.match(productIdentityMigration, /Administrateur : consultation uniquement/);
  assert.match(productIdentityMigration, /drop policy if exists produits_write/);
  assert.match(productIdentityMigration, /drop policy if exists produits_update/);
  assert.match(productIdentitySqlTest, /partition by t\.n,s\.pharmacie_id/i);
  assert.match(productIdentitySqlTest, /group by d\.pharmacie_id/i);
  assert.match(productIdentitySqlTest, /produits_pharmacy_identity_uq/i);
  assert.match(productIdentitySqlTest, /is_admin/i);
});

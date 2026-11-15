"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const adminProductsPage = fs.readFileSync(
  path.join(root, "src/app/admin/produits/page.tsx"),
  "utf8"
);
const adminProfile = fs.readFileSync(
  path.join(root, "src/app/admin/profil/page.tsx"),
  "utf8"
);
const photoUpload = fs.readFileSync(
  path.join(root, "src/components/PhotoUpload.tsx"),
  "utf8"
);

test("l'administration consulte le catalogue sans approuver ni modifier les fiches", () => {
  assert.match(adminProductsPage, /requireAdminActive\("\/admin\/produits"\)/);
  assert.match(adminProductsPage, /en lecture seule/i);
  assert.match(adminProductsPage, /NAXA ne vérifie, ne certifie, n'approuve et ne corrige pas les fiches/i);
  assert.doesNotMatch(adminProductsPage, /fiche_validee|Fiche relue par un pharmacien|brouillonIA|enregistrerFiche|formAction/);
});

test("l'administration ne reçoit aucun formulaire de publication ou de validation produit", () => {
  assert.doesNotMatch(adminProductsPage, /<PhotoUpload|formAction|enregistrerFiche|brouillonIA|fiche_validee/);
  assert.match(adminProductsPage, /Déclaration pharmacie/);
});

test("l'upload d'image reste conditionné à une source, une licence et l'enregistrement des métadonnées", () => {
  assert.match(photoUpload, /sourceUrl\.trim\(\)\.startsWith\("https:\/\/"\)/);
  assert.match(photoUpload, /licence\.trim\(\)\.length < 5/);
  assert.match(photoUpload, /!droitsConfirmes/);
  assert.match(photoUpload, /updateError \|\| updated\?\.id !== produitId/);
});

test("le profil personnel Admin conserve son contrôle de résultat d'écriture", () => {
  assert.match(adminProfile, /\.eq\("id", auth\.user\.id\)\.select\("id"\)\.maybeSingle\(\)/);
  assert.match(adminProfile, /updateError \|\| updated\?\.id !== auth\.user\.id/);
});

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const page = fs.readFileSync(
  path.join(root, "src/app/pharmacie/caisse/page.tsx"),
  "utf8",
);

test("la visibilité Marketplace ne conditionne pas l'accès à la Caisse interne", () => {
  assert.match(page, /select\("id,nom,actif,archivee_le"\)/);
  assert.match(page, /pharmacy\.actif !== true \|\| pharmacy\.archivee_le !== null/);
  assert.doesNotMatch(page, /pharmacy\.visible_recherche !== true/);
});

test("la page Caisse conserve la barrière sur les pharmacies inactives ou archivées", () => {
  assert.match(page, /pharmacy\.actif !== true/);
  assert.match(page, /pharmacy\.archivee_le !== null/);
  assert.match(page, /La pharmacie est inactive ou archivée/);
});

test("la Caisse continue d'exiger le rôle authentifié et son périmètre pharmacie actif", () => {
  assert.match(page, /activeRole !== "caisse"/);
  assert.match(page, /naxa_active_role_pharmacy/);
  assert.match(page, /naxa_business_function/);
});

const loginRoute = fs.readFileSync(
  path.join(root, "src/app/api/auth/login/route.ts"),
  "utf8",
);

test("la connexion professionnelle autorise une pharmacie masquée mais active", () => {
  assert.match(loginRoute, /select\("id,actif,archivee_le"\)/);
  assert.match(loginRoute, /\.is\("archivee_le", null\)/);
  assert.doesNotMatch(loginRoute, /\.eq\("visible_recherche",\s*true\)/);
});

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function roleSet(source) {
  const match = source.match(/const PHARMACY_ROLE_CODES = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(match, "liste canonique des fonctions professionnelles absente");
  return [...match[1].matchAll(/"([a-z_]+)"/g)].map((item) => item[1]).sort();
}

test("Web et session native exposent exactement les mêmes fonctions Pharmacie", () => {
  const web = read("src/app/api/auth/login/route.ts");
  const native = read("src/app/api/v1/auth/session/route.ts");
  assert.deepEqual(roleSet(web), roleSet(native));
  for (const role of [
    "promoteur",
    "responsable",
    "caisse",
    "comptable",
    "pharmacien",
    "gestionnaire_stock",
    "magasinier",
    "livreur",
    "pharmacie",
  ]) {
    assert.ok(roleSet(web).includes(role), role + " doit être reconnu sur les deux canaux");
  }
});

test("Web et natif utilisent le même résolveur serveur du rôle actif et du périmètre pharmacie", () => {
  const web = read("src/app/api/auth/login/route.ts");
  const native = read("src/app/api/v1/auth/session/route.ts");
  assert.match(web, /rpc\("naxa_business_function"\)/);
  assert.match(native, /rpc\("naxa_business_function"\)/);
  assert.match(web, /rpc\("naxa_active_role_pharmacy"\)/);
  assert.match(native, /rpc\("naxa_active_role_pharmacy"\)/);
  assert.ok(
    web.indexOf("signInWithPassword") < web.indexOf('rpc("naxa_business_function")'),
    "le rôle Web doit être résolu dans la session authentifiée"
  );
  assert.doesNotMatch(native, /profile\.pharmacie_id/);
});

test("un refus de périmètre Web ferme la session créée pendant la résolution", () => {
  const web = read("src/app/api/auth/login/route.ts");
  assert.match(web, /await supabase\.auth\.signOut\(\)/);
  assert.match(web, /PHARMACY_ROLE_CODES\.has\(activeRole\)/);
});

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
  assert.match(web, /await supabase\.auth\.signOut\(\{\s*scope:\s*["']local["']\s*\}\)/);
  assert.match(web, /PHARMACY_ROLE_CODES\.has\(activeRole\)/);
});

test("le Livreur dispose d'un espace dédié et du même périmètre pharmacie sur les deux canaux", () => {
  const nativeSession = read("src/app/api/v1/auth/session/route.ts");
  const nativeRouting = read("android/app/src/main/java/cm/naxa/app/NativeRoleRouting.kt");
  const nativeActivity = read("android/app/src/main/java/cm/naxa/app/MainActivity.kt");
  const webPharmacyHome = read("src/app/pharmacie/page.tsx");
  assert.ok(nativeSession.includes('activeRole === "livreur"'));
  assert.ok(nativeSession.includes('activeWorkspace = "livreur"'));
  assert.ok(nativeSession.includes('activeWorkspace === "livreur"'));
  assert.ok(nativeSession.includes('naxa_active_role_pharmacy'));
  assert.ok(nativeRouting.includes('role == "livreur" && workspace == "livreur"'));
  assert.ok(nativeActivity.includes("supportsCourierWorkspace(currentProfile.effectiveRole, currentProfile.activeWorkspace)"));
  assert.ok(webPharmacyHome.includes('livreur:"/pharmacie/livreur"'));
  assert.ok(webPharmacyHome.includes("if(roleDestination){window.location.replace(roleDestination);return}"));
});

test("les postes Comptable, Pharmacien et Gestionnaire Stock sont dirigés vers leur espace Web métier", () => {
  const home = read("src/app/pharmacie/page.tsx");
  for (const path of [
    "comptable:\"/pharmacie/comptable\"",
    "pharmacien:\"/pharmacie/pharmacien\"",
    "gestionnaire_stock:\"/pharmacie/gestionnaire-stock\"",
  ]) assert.ok(home.includes(path), path + " doit être routé");
});

test("la connexion Web route tous les profils selon le rôle métier actif, pas le rôle racine Client", () => {
  const login = read("src/app/(auth)/connexion/page.tsx");
  assert.ok(login.includes('sb.rpc("naxa_business_function")'));
  assert.ok(login.includes('livreur: "/pharmacie/livreur"'));
  assert.ok(login.includes('comptable: "/pharmacie/comptable"'));
  assert.ok(login.includes('pharmacien: "/pharmacie/pharmacien"'));
  assert.ok(login.includes('gestionnaire_stock: "/pharmacie/gestionnaire-stock"'));
  assert.ok(login.includes('caisse: "/pharmacie/caisse"'));
  assert.ok(!login.includes("profile?.role") && !login.includes("profile.role"));
});

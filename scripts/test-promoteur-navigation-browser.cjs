"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "e2e", "verify-promoteur-navigation-browser.cjs"),
  "utf8"
);
const workflow = fs.readFileSync(
  path.join(__dirname, "..", ".github", "workflows", "naxa-nav-promoteur-e2e.yml"),
  "utf8"
);

test("la recette est limitée au projet Supabase Replay connu", () => {
  assert.match(source, /const PROJECT_REF = "pwfftcsjyeibxxqhwysw"/);
  assert.match(source, /assertReplayUrl\(env\.NAXA_STORAGE_E2E_URL \|\| env\.SUPABASE_URL\)/);
});

test("la recette réutilise uniquement la fixture Promoteur existante et marquée", () => {
  assert.match(source, /naxa_e2e_promoteur/);
  assert.match(source, /naxa\.e2e\.promoteur@example\.invalid/);
  assert.match(source, /naxa_e2e_promoteur, PROMOTEUR_MARKER/);
  assert.match(source, /profile\.role, "promoteur"/);
  assert.match(source, /profile\.actif, true/);
  assert.match(source, /authMatches\.length, 1/);
  assert.match(source, /espace=pharmacie/);
});

test("aucun endpoint de création Auth ou de données métier n'est utilisé", () => {
  assert.doesNotMatch(source, /adminRequest\([^\n]*\/auth\/v1\/admin\/users["']\s*,\s*["']POST/);
  assert.doesNotMatch(source, /\/rest\/v1\/(?:pharmacies|naxa_professional_assignments|partners|partner_members)/);
  assert.doesNotMatch(source, /method:\s*["']POST["']/);
  assert.match(source, /"PUT",\s*\{ password \}/);
});

test("la recette clique les deux navigations Promoteur et vérifie la destination", () => {
  assert.match(source, /Sections Promoteur/);
  assert.match(source, /Livraisons du réseau/);
  assert.match(source, /Navigation des sous-pages Promoteur/);
  assert.match(source, /Livraisons de mon réseau/);
  assert.match(source, /page\.waitForURL\(url => url\.pathname === TARGET_PATH/);
  assert.match(source, /390, height: 844/);
});

test("le serveur local possède ses variables Admin et rate-limit dédiées à Replay", () => {
  assert.match(workflow, /SUPABASE_SECRET_KEY=\"\$NAXA_STORAGE_E2E_ADMIN_KEY\"/);
  assert.match(workflow, /NAXA_RATE_LIMIT_SECRET=\"\$\(openssl rand -hex 32\)\"/);
  assert.match(workflow, /test \"\$\{#NAXA_RATE_LIMIT_SECRET\}\" -ge 32/);
});

test("la recette ferme explicitement la session navigateur", () => {
  assert.match(source, /Déconnexion/);
  assert.match(source, /logoutPassed, true/);
});

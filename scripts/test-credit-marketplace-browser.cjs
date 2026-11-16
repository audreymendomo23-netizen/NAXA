"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "e2e", "verify-credit-marketplace-browser.cjs"),
  "utf8"
);
const workflow = fs.readFileSync(
  path.join(__dirname, "..", ".github", "workflows", "naxa-replay-promoteur-secret-safe-v2.yml"),
  "utf8"
);

test("la recette Promoteur cible la référence exacte de la demande Marketplace", () => {
  assert.match(source, /const requestReference = requestId\.replace\(/);
  assert.match(source, /name: "Demande #" \+ requestReference/);
  assert.match(source, /filter\(\{ has: requestHeading \}\)/);
  assert.match(source, /includes\("Source : Marketplace"\)/);
  assert.match(source, /includes\("en_attente"\)/);
  assert.match(source, /refuseButton\.count\(\) !== 1/);
  assert.doesNotMatch(source, /filter\(\{ hasText: PRODUCT_NAME \}\)/);
});

test("un échec POS/Marketplace n'interrompt pas les recettes navigateur indépendantes", () => {
  const start = workflow.indexOf("name: Recette navigateur crédit comptoir");
  const end = workflow.indexOf("name: Exécuter Storage E2E", start);
  assert.ok(start >= 0 && end > start, "bloc de recette navigateur introuvable");
  const block = workflow.slice(start, end);
  assert.match(block, /auth_failures=0/);
  assert.match(block, /browser_failures=0/);
  assert.match(block, /auth_failures=\$\(\(auth_failures \+ 1\)\)/);
  assert.match(block, /browser_failures=\$\(\(browser_failures \+ 1\)\)/);
  assert.match(block, /run_auth_check scripts\/e2e\/verify-auth-session-lifecycle\.cjs/);
  assert.doesNotMatch(block, /run_browser_check scripts\/e2e\/verify-auth-session-lifecycle\.cjs/);
  assert.match(block, /run_browser_check scripts\/e2e\/verify-credit-pos-browser\.cjs/);
  assert.match(block, /run_browser_check scripts\/e2e\/verify-credit-marketplace-browser\.cjs/);
  assert.match(block, /run_browser_check scripts\/e2e\/verify-credit-accounting-browser\.cjs/);
  assert.match(block, /if \[ "\$auth_failures" -gt 0 \] \|\| \[ "\$browser_failures" -gt 0 \]; then/);
  assert.match(block, /Résultats navigateur — Auth: \$auth_failures.*Crédit: \$browser_failures/);
});

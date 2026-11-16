"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "e2e", "verify-credit-marketplace-browser.cjs"),
  "utf8"
);

test("la recette Promoteur cible la demande Marketplace la plus récente encore en attente", () => {
  assert.match(source, /filter\(\{ hasText: PRODUCT_NAME \}\)/);
  assert.match(source, /filter\(\{ hasText: "en_attente" \}\)/);
  assert.match(source, /\.first\(\)/);
  assert.match(source, /refuseButton\.count\(\) !== 1/);
  assert.doesNotMatch(source, /filter\(\{ hasText: PRODUCT_NAME \}\)\.last\(\)/);
});

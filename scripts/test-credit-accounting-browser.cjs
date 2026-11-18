"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "e2e", "verify-credit-accounting-browser.cjs"),
  "utf8"
);

test("la recette comptable vérifie le statut Validé avec sa période affichée", () => {
  assert.equal((source.match(/getByText\(\/\^Validé\\s\*·\//g) || []).length, 4);
  assert.doesNotMatch(source, /article\.getByText\("Validé", \{ exact: true \}\)/);
});

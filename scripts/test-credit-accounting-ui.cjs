"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../src/components/pharmacie/ComptaPlanManager.tsx"),
  "utf8",
);

test("le plan comptable expose les événements d'octroi et de remboursement du crédit", () => {
  assert.match(source, /value: "credit_octroi", label: "Octroi de crédit client"/);
  assert.match(source, /value: "credit_remboursement", label: "Remboursement de crédit client"/);
});

test("les deux événements crédit sont inclus dans les choix de journaux et mappings", () => {
  assert.match(source, /const ACCOUNTING_EVENTS = \[/);
  assert.match(source, /const MAPPING_EVENTS = ACCOUNTING_EVENTS\.filter\(item => item\.value !== "vente_annulee"\)/);
  assert.match(source, /ACCOUNTING_EVENTS\.map/);
  assert.match(source, /MAPPING_EVENTS\.map/);
});

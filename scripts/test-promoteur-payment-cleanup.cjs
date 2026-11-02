const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const actions = fs.readFileSync(path.join(root, "src/app/promoteur/paiements/actions.ts"), "utf8");
const page = fs.readFileSync(path.join(root, "src/app/promoteur/paiements/page.tsx"), "utf8");

test("une preuve uploadée est compensée par deux tentatives et vérification réelle Storage", () => {
  assert.match(actions, /for \(let attempt = 0; attempt < 2 && !proofRemoved; attempt \+= 1\)/);
  assert.match(actions, /bucket\.remove\(\[proofPath\]\)/);
  assert.match(actions, /bucket\.list\(folder,[\s\S]*search: filename/);
  assert.match(actions, /remaining \?\? \[\]\)\.some\(file => file\.name === filename\)/);
});

test("un échec de compensation est journalisé et ne se présente jamais comme un paiement soumis", () => {
  assert.match(actions, /action: "reglement_preuve_orpheline"/);
  assert.match(actions, /storage_path: proofPath/);
  assert.match(actions, /redirect\("\/promoteur\/paiements\?erreur=nettoyage_preuve"\)/);
  assert.match(page, /nettoyage_preuve:/);
  assert.match(page, /ne renvoyez pas le même paiement avant vérification/);
});

test("la période annoncée dans l'espace Promoteur respecte un mois calendaire", () => {
  assert.match(page, /un mois calendaire/);
  assert.doesNotMatch(page, /échéance est calculée à 31 jours/);
});

process.stdout.write("Contrat statique paiement Promoteur et compensation Storage vérifié.\n");

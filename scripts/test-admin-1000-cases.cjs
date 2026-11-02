const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const matrixPath = path.join(__dirname, "../docs/audits/ADMIN_360_CAS_PRATIQUES_1000.json");
const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));

test("la matrice contient exactement 1 000 cas identifiés de façon unique", () => {
  assert.equal(matrix.cases.length, 1000);
  assert.equal(new Set(matrix.cases.map(item => item.case_id)).size, 1000);
});

test("les 1 000 cas couvrent 20 fonctions, 5 profils et 10 situations", () => {
  assert.equal(matrix.dimensions.capabilities.length, 20);
  assert.equal(matrix.dimensions.actors.length, 5);
  assert.equal(matrix.dimensions.scenarios.length, 10);
  assert.equal(matrix.cases.length, 20 * 5 * 10);
});

test("les cas distinguent accès autorisés, refus attendus et recette runtime", () => {
  assert.equal(matrix.cases.filter(item => item.expected_access === "ALLOW").length, 160);
  assert.equal(matrix.cases.filter(item => item.expected_access === "DENY").length, 840);
  assert.equal(matrix.totals.executed, false);
  assert.ok(matrix.cases.every(item => item.execution_status === "SCENARIO_SIMULE — NON EXECUTE EN CI/APP"));
});

test("chaque capacité simulée pointe vers des fichiers réellement présents", () => {
  const missing = [...new Set(matrix.cases.flatMap(item => item.source_files))]
    .filter(file => !fs.existsSync(path.join(__dirname, "..", file)));
  assert.deepEqual(missing, []);
});

test("chaque cas documente détection, diagnostic, périmètre, action, résolution et traçabilité", () => {
  for (const item of matrix.cases) {
    assert.ok(item.detection_criteria);
    assert.ok(item.diagnosis_criteria);
    assert.ok(item.data_access_criteria);
    assert.ok(item.action_criteria);
    assert.ok(item.resolution_verification);
    assert.ok(item.traceability);
    assert.ok(item.source_or_test_evidence);
  }
});

process.stdout.write("Matrice Admin 360 : 1 000 scénarios distincts, sources vérifiables.\n");

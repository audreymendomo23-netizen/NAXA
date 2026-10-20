const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadTypeScript(relativePath) {
  const filename = path.join(__dirname, "..", relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}

const calc = loadTypeScript("src/lib/caisse/calculs.ts");
const format = loadTypeScript("src/lib/caisse/format.ts");

assert.equal(calc.montantEntier("1250"), 1250);
assert.equal(calc.totalLigne(150, 3), 450);
assert.equal(calc.totalPanier([450, 250, 0]), 700);
assert.equal(calc.monnaieARendre(1000, 700), 300);
assert.equal(calc.monnaieARendre(500, 700), 0);
assert.equal(calc.calculerEcartCaisse(9000, 8500), 500);
assert.equal(calc.calculerEcartCaisse(8000, 8500), -500);
assert.equal(format.formaterFcfa(1250), "1 250 FCFA");

assert.throws(() => calc.montantEntier("12.5"), RangeError);
assert.throws(() => calc.totalLigne(-1, 1), RangeError);
assert.throws(() => calc.totalLigne(100, 0), RangeError);
assert.throws(() => calc.totalPanier([100, -1]), RangeError);
assert.throws(() => calc.monnaieARendre(-1, 100), RangeError);
assert.throws(() => calc.totalPanier([Number.MAX_SAFE_INTEGER, 1]), RangeError);
assert.throws(() => format.formaterFcfa(12.5), RangeError);

process.stdout.write("OK — 15 assertions caisse (calculs FCFA, rendu, écart, format et erreurs).\\n");

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");

const sourcePath = path.join(__dirname, "../src/lib/delivery-pricing.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 });
const pricingModule = new Module(sourcePath, module);
pricingModule.filename = sourcePath;
pricingModule.paths = Module._nodeModulePaths(path.dirname(sourcePath));
pricingModule._compile(compiled, sourcePath);
const { calculerFraisLivraison, repartirFraisLivraison } = pricingModule.exports;

test("le tarif respecte le plancher 1 500 FCFA, le calcul kilométrique et le plafond 3 500 FCFA", () => {
  assert.equal(calculerFraisLivraison(0.1), 1520);
  assert.equal(calculerFraisLivraison(1.5), 1800);
  assert.equal(calculerFraisLivraison(5), 2500);
  assert.equal(calculerFraisLivraison(10), 3500);
  assert.equal(calculerFraisLivraison(30), 3500);
});

test("la commission NAXA est fixe à 500 FCFA et comprise dans le tarif", () => {
  assert.deepEqual(repartirFraisLivraison(1800), {
    fraisClient: 1800,
    commissionNaxa: 500,
    soldeLivraison: 1300,
  });
  assert.deepEqual(repartirFraisLivraison(1500), {
    fraisClient: 1500,
    commissionNaxa: 500,
    soldeLivraison: 1000,
  });
  assert.deepEqual(repartirFraisLivraison(3500), {
    fraisClient: 3500,
    commissionNaxa: 500,
    soldeLivraison: 3000,
  });
  for (const amount of [1500, 1800, 2500, 3500]) {
    const split = repartirFraisLivraison(amount);
    assert.equal(split.fraisClient, split.commissionNaxa + split.soldeLivraison);
  }
});

test("les distances et tarifs invalides sont refusés", () => {
  assert.throws(() => calculerFraisLivraison(0), error => error?.name === "RangeError");
  assert.throws(() => calculerFraisLivraison(-1), error => error?.name === "RangeError");
  assert.throws(() => calculerFraisLivraison(Number.NaN), error => error?.name === "RangeError");
  assert.throws(() => repartirFraisLivraison(1499), error => error?.name === "RangeError");
  assert.throws(() => repartirFraisLivraison(3501), error => error?.name === "RangeError");
});

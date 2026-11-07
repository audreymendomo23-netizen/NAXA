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

test("le tarif respecte le plancher, le calcul kilométrique et le plafond", () => {
  assert.equal(calculerFraisLivraison(0.1), 1020);
  assert.equal(calculerFraisLivraison(1.5), 1300);
  assert.equal(calculerFraisLivraison(5), 2000);
  assert.equal(calculerFraisLivraison(10), 3000);
  assert.equal(calculerFraisLivraison(30), 3000);
});

test("la commission NAXA est fixe à 500 FCFA et comprise dans le tarif", () => {
  assert.deepEqual(repartirFraisLivraison(1300), {
    fraisClient: 1300,
    commissionNaxa: 500,
    soldeLivraison: 800,
  });
  assert.deepEqual(repartirFraisLivraison(1000), {
    fraisClient: 1000,
    commissionNaxa: 500,
    soldeLivraison: 500,
  });
  for (const amount of [1000, 1300, 2000, 3000]) {
    const split = repartirFraisLivraison(amount);
    assert.equal(split.fraisClient, split.commissionNaxa + split.soldeLivraison);
  }
});

test("les distances et tarifs invalides sont refusés", () => {
  assert.throws(() => calculerFraisLivraison(0), error => error?.name === "RangeError");
  assert.throws(() => calculerFraisLivraison(-1), error => error?.name === "RangeError");
  assert.throws(() => calculerFraisLivraison(Number.NaN), error => error?.name === "RangeError");
  assert.throws(() => repartirFraisLivraison(999), error => error?.name === "RangeError");
  assert.throws(() => repartirFraisLivraison(3001), error => error?.name === "RangeError");
});

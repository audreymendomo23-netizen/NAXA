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

test("le forfait de 1 500 FCFA couvre les 2,5 premiers kilomètres", () => {
  assert.equal(calculerFraisLivraison(0.1), 1500);
  assert.equal(calculerFraisLivraison(1.5), 1500);
  assert.equal(calculerFraisLivraison(2.5), 1500);
});

test("au-delà de 2,5 km, le supplément est de 100 FCFA par km au prorata", () => {
  assert.equal(calculerFraisLivraison(2.51), 1501);
  assert.equal(calculerFraisLivraison(3), 1550);
  assert.equal(calculerFraisLivraison(5), 1750);
  assert.equal(calculerFraisLivraison(10), 2250);
  assert.equal(calculerFraisLivraison(22.49), 3499);
});

test("le plafond est de 3 500 FCFA à partir de 22,5 km", () => {
  assert.equal(calculerFraisLivraison(22.5), 3500);
  assert.equal(calculerFraisLivraison(30), 3500);
});

test("la commission NAXA est fixe à 500 FCFA et comprise dans le tarif", () => {
  assert.deepEqual(repartirFraisLivraison(1500), {
    fraisClient: 1500,
    commissionNaxa: 500,
    soldeLivraison: 1000,
  });
  assert.deepEqual(repartirFraisLivraison(1550), {
    fraisClient: 1550,
    commissionNaxa: 500,
    soldeLivraison: 1050,
  });
  assert.deepEqual(repartirFraisLivraison(1750), {
    fraisClient: 1750,
    commissionNaxa: 500,
    soldeLivraison: 1250,
  });
  assert.deepEqual(repartirFraisLivraison(3500), {
    fraisClient: 3500,
    commissionNaxa: 500,
    soldeLivraison: 3000,
  });
  for (const distance of [2.5, 3, 5, 10, 22.5]) {
    const split = repartirFraisLivraison(calculerFraisLivraison(distance));
    assert.equal(split.fraisClient, split.commissionNaxa + split.soldeLivraison);
    assert.equal(split.commissionNaxa, 500);
  }
});

test("les distances et tarifs invalides sont refusés", () => {
  assert.throws(() => calculerFraisLivraison(0), error => error?.name === "RangeError");
  assert.throws(() => calculerFraisLivraison(-1), error => error?.name === "RangeError");
  assert.throws(() => calculerFraisLivraison(Number.NaN), error => error?.name === "RangeError");
  assert.throws(() => repartirFraisLivraison(1499), error => error?.name === "RangeError");
  assert.throws(() => repartirFraisLivraison(3501), error => error?.name === "RangeError");
});

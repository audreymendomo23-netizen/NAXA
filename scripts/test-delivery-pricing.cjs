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
const {
  calculerTarifProgressif,
  calculerFraisLivraison,
  selectionnerZoneTarifaire,
  repartirFraisLivraison,
} = pricingModule.exports;

test("le forfait de 1 500 FCFA couvre les 2,5 premiers kilomètres inclus", () => {
  assert.equal(calculerFraisLivraison(0.1), 1500);
  assert.equal(calculerFraisLivraison(1.5), 1500);
  assert.equal(calculerFraisLivraison(2.5), 1500);
});

test("les tranches kilométriques deviennent progressivement plus chères", () => {
  assert.equal(calculerFraisLivraison(2.51), 1501);
  assert.equal(calculerFraisLivraison(3), 1550);
  assert.equal(calculerFraisLivraison(5), 1750);
  assert.equal(calculerFraisLivraison(7), 2050);
  assert.equal(calculerFraisLivraison(10), 2500);
  assert.equal(calculerFraisLivraison(15), 3500);
  assert.equal(calculerTarifProgressif(20), 4500);
  assert.equal(calculerTarifProgressif(25), 5750);
  assert.equal(calculerTarifProgressif(50), 12000);
});

test("le plafond de 3 500 FCFA ne s'applique pas aux zones éloignées ou difficiles", () => {
  assert.equal(calculerFraisLivraison(20, "standard", 0), 3500);
  assert.equal(calculerFraisLivraison(20, "periurbaine", 300), 3500);
  assert.equal(calculerFraisLivraison(20, "eloignee", 700), 5200);
  assert.equal(calculerFraisLivraison(20, "difficile", 1200), 5700);
  assert.equal(calculerFraisLivraison(50, "difficile", 1200), 13200);
});

test("la résolution géographique choisit la zone la plus contraignante en cas de chevauchement", () => {
  const destination = { lat: 3.8, lng: 11.5 };
  const zones = [
    { id: "peri", nom: "Périphérie", zone_type: "periurbaine", centre_latitude: 3.8, centre_longitude: 11.5, rayon_km: 5, supplement_fcfa: 300 },
    { id: "remote", nom: "Zone éloignée", zone_type: "eloignee", centre_latitude: 3.8, centre_longitude: 11.5, rayon_km: 4, supplement_fcfa: 700 },
    { id: "hard", nom: "Accès difficile", zone_type: "difficile", centre_latitude: 3.8, centre_longitude: 11.5, rayon_km: 2, supplement_fcfa: 1200 },
  ];
  assert.equal(selectionnerZoneTarifaire(destination, zones).id, "hard");
  assert.equal(selectionnerZoneTarifaire({ lat: 8.5, lng: 13.4 }, zones), null);
});

test("la commission NAXA reste fixe à 500 FCFA et est incluse dans chaque tarif", () => {
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
  assert.deepEqual(repartirFraisLivraison(5200), {
    fraisClient: 5200,
    commissionNaxa: 500,
    soldeLivraison: 4700,
  });
  assert.deepEqual(repartirFraisLivraison(13200), {
    fraisClient: 13200,
    commissionNaxa: 500,
    soldeLivraison: 12700,
  });
  for (const amount of [1500, 1750, 3500, 5200, 13200, 20000]) {
    const split = repartirFraisLivraison(amount);
    assert.equal(split.fraisClient, split.commissionNaxa + split.soldeLivraison);
    assert.equal(split.commissionNaxa, 500);
  }
});

test("les distances, majorations et montants hors limites sont refusés", () => {
  assert.throws(() => calculerFraisLivraison(0), error => error?.name === "RangeError");
  assert.throws(() => calculerFraisLivraison(-1), error => error?.name === "RangeError");
  assert.throws(() => calculerFraisLivraison(50.1), error => error?.name === "RangeError");
  assert.throws(() => calculerFraisLivraison(5, "difficile", 5001), error => error?.name === "RangeError");
  assert.throws(() => repartirFraisLivraison(1499), error => error?.name === "RangeError");
  assert.throws(() => repartirFraisLivraison(20001), error => error?.name === "RangeError");
});

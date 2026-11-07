const test = require("node:test");
const assert = require("node:assert/strict");
const { calculerFraisLivraison, repartirFraisLivraison } = require("../src/lib/delivery-pricing");

test("le tarif respecte le plancher, le calcul kilométrique et le plafond", () => {
  assert.equal(calculerFraisLivraison(0), 1500);
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
  for (const amount of [1500, 1800, 2500, 3500]) {
    const split = repartirFraisLivraison(amount);
    assert.equal(split.fraisClient, split.commissionNaxa + split.soldeLivraison);
  }
});

test("les distances et tarifs invalides sont refusés", () => {
  assert.throws(() => calculerFraisLivraison(-1), RangeError);
  assert.throws(() => calculerFraisLivraison(Number.NaN), RangeError);
  assert.throws(() => repartirFraisLivraison(1200), RangeError);
});

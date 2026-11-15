"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  sumLotQuantities,
  assertStockLotBalance,
  buildStockPayload,
  buildStockRestorePayload,
  restErrorSummary,
} = require("./e2e/expiry-stock-aggregate.cjs");

test("la somme agrégée additionne les quantités des lots sans mutation", () => {
  const rows = [{ quantite: 2 }, { quantite: "3" }, { quantite: 0 }];
  assert.equal(sumLotQuantities(rows), 5);
  assert.deepEqual(rows, [{ quantite: 2 }, { quantite: "3" }, { quantite: 0 }]);
});

test("les quantités de lots négatives, non entières ou non numériques sont refusées", () => {
  assert.throws(() => sumLotQuantities(null), /Liste de lots invalide/);
  assert.throws(() => sumLotQuantities([{ quantite: -1 }]), /quantité de lot est invalide/);
  assert.throws(() => sumLotQuantities([{ quantite: 1.5 }]), /quantité de lot est invalide/);
  assert.throws(() => sumLotQuantities([{ quantite: "abc" }]), /quantité de lot est invalide/);
});

test("un stock déjà lotisé doit correspondre à la somme actuelle des lots avant la recette", () => {
  assert.equal(assertStockLotBalance({ quantite: 5 }, [{ quantite: 2 }, { quantite: 3 }]), 5);
  assert.throws(
    () => assertStockLotBalance({ quantite: 5 }, [{ quantite: 0 }]),
    /ne correspond pas à la somme des lots/
  );
  assert.throws(
    () => assertStockLotBalance(null, [{ quantite: 1 }]),
    /sans stock agrégé/
  );
  assert.equal(assertStockLotBalance(null, []), 0);
});

test("la préparation du stock conserve la somme existante au lieu d'imposer cinq unités", () => {
  const payload = buildStockPayload({
    pharmacyId: "pharmacy",
    productId: "product",
    stockRow: { prix: 1200, quantite: 4, date_peremption: "2026-12-31", emplacement: "Rayon A" },
    baseLotsQuantity: 4,
  });
  assert.deepEqual(payload, {
    pharmacie_id: "pharmacy",
    produit_id: "product",
    prix: 1200,
    quantite: 4,
    date_peremption: "2026-12-31",
    emplacement: "Rayon A",
  });
  assert.throws(
    () => buildStockPayload({ pharmacyId: "p", productId: "x", stockRow: null, baseLotsQuantity: -1 }),
    /Base de stock invalide/
  );
});

test("le nettoyage restaure le stock préexistant ou supprime la ligne créée par le test", () => {
  const restored = buildStockRestorePayload({
    stockRow: { prix: 1200, date_peremption: "2026-12-31", emplacement: "Rayon A" },
    remainingLots: [{ quantite: 2 }, { quantite: 3 }],
  });
  assert.deepEqual(restored, {
    prix: 1200,
    quantite: 5,
    date_peremption: "2026-12-31",
    emplacement: "Rayon A",
  });
  assert.equal(buildStockRestorePayload({ stockRow: null, remainingLots: [] }), null);
  assert.deepEqual(
    buildStockRestorePayload({ stockRow: null, remainingLots: [{ quantite: 0 }] }),
    { prix: 900, quantite: 0, date_peremption: null, emplacement: "E2E — non commercial" }
  );
});

test("le diagnostic REST ne conserve que le code et le message bornés", () => {
  assert.equal(restErrorSummary({
    code: "P0001",
    message: "Stock lotisé : quantité agrégée incorrecte",
    details: "secret details must not be displayed",
    hint: "private hint",
  }), "P0001 — Stock lotisé : quantité agrégée incorrecte");
  assert.equal(restErrorSummary({}), "");
});

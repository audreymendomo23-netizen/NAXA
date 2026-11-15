"use strict";

const DEFAULT_TEST_PRICE = 900;
const DEFAULT_TEST_LOCATION = "E2E — non commercial";

function sumLotQuantities(rows) {
  if (!Array.isArray(rows)) throw new Error("Liste de lots invalide.");
  return rows.reduce((sum, row) => {
    const quantity = Number(row?.quantite);
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      throw new Error("Une quantité de lot est invalide.");
    }
    const next = sum + quantity;
    if (!Number.isSafeInteger(next)) {
      throw new Error("La somme des lots dépasse la plage numérique sûre.");
    }
    return next;
  }, 0);
}

function assertStockLotBalance(stockRow, lotRows) {
  const lotsQuantity = sumLotQuantities(lotRows);
  if (stockRow && Number(stockRow.quantite) !== lotsQuantity) {
    throw new Error("Stock de recette incohérent avant test : la quantité agrégée ne correspond pas à la somme des lots.");
  }
  if (!stockRow && lotsQuantity !== 0) {
    throw new Error("Des lots préexistants sont présents sans stock agrégé ; test interrompu sans correction automatique.");
  }
  return lotsQuantity;
}

function buildStockPayload({ pharmacyId, productId, stockRow, baseLotsQuantity }) {
  if (!pharmacyId || !productId || !Number.isSafeInteger(baseLotsQuantity) || baseLotsQuantity < 0) {
    throw new Error("Base de stock invalide pour la fixture E2E.");
  }
  return {
    pharmacie_id: pharmacyId,
    produit_id: productId,
    prix: stockRow?.prix ?? DEFAULT_TEST_PRICE,
    quantite: baseLotsQuantity,
    date_peremption: stockRow?.date_peremption ?? null,
    emplacement: stockRow?.emplacement ?? DEFAULT_TEST_LOCATION,
  };
}

function buildStockRestorePayload({ stockRow, remainingLots }) {
  const restoredQuantity = sumLotQuantities(remainingLots);
  if (stockRow) {
    return {
      prix: stockRow.prix,
      quantite: restoredQuantity,
      date_peremption: stockRow.date_peremption,
      emplacement: stockRow.emplacement,
    };
  }
  if (remainingLots.length === 0) return null;
  return {
    prix: DEFAULT_TEST_PRICE,
    quantite: restoredQuantity,
    date_peremption: null,
    emplacement: DEFAULT_TEST_LOCATION,
  };
}

function restErrorSummary(data) {
  const code = typeof data?.code === "string" ? data.code.slice(0, 32) : "";
  const message = typeof data?.message === "string" ? data.message.slice(0, 220) : "";
  return [code, message].filter(Boolean).join(" — ");
}

module.exports = {
  sumLotQuantities,
  assertStockLotBalance,
  buildStockPayload,
  buildStockRestorePayload,
  restErrorSummary,
};

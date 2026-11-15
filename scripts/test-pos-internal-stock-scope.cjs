"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261115205000_pos_internal_sellable_stock_scope.sql"),
  "utf8"
);
const sqlContract = fs.readFileSync(
  path.join(root, "supabase/tests/20261115205000_pos_internal_stock_scope.sql"),
  "utf8"
);

function functionBody(source, marker, endMarker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, "Fonction introuvable : " + marker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, "Fin de fonction introuvable : " + marker);
  return source.slice(start, end);
}

test("le stock vendable interne reste distinct de la visibilité Marketplace", () => {
  const helper = functionBody(
    migration,
    "create or replace function private.naxa_pos_stock_vendable",
    "$function$;"
  );
  assert.ok(helper.includes("ph.actif is true"));
  assert.ok(helper.includes("ph.archivee_le is null"));
  assert.ok(helper.includes("public.stocks_lots"));
  assert.ok(helper.includes("coalesce(l.bloque, false) = false"));
  assert.ok(helper.includes("l.date_peremption >= v_today"));
  assert.ok(helper.includes("public.reservation_items"));
  assert.ok(helper.includes("r.expires_at > now()"));
  assert.ok(!helper.includes("visible_recherche"));
  assert.ok(!helper.includes("est_demo"));
  assert.ok(!helper.includes("marketplace_stock_last_quantity_update"));
});

test("les quatre consommateurs POS utilisent le stock privé plutôt que le filtre Marketplace", () => {
  for (const signature of [
    "private.naxa_pos_debit_stock(uuid)",
    "public.vente_ajouter_produit(uuid,uuid,integer)",
    "public.caisse_rechercher_produit(uuid,text,text)",
    "public.caisse_rechercher_codes(uuid,text[])",
  ]) {
    assert.ok(migration.includes("'" + signature + "'::regprocedure"), signature);
  }
  assert.ok(migration.includes("private.naxa_pos_stock_vendable("));
  assert.ok(migration.includes("avail.prix,avail.quantite"));
  assert.ok(migration.includes("cross join lateral private.naxa_pos_stock_vendable"));
  assert.ok(migration.includes("public.marketplace_offre_stock_disponible("));
});

test("le rôle Caisse conserve le scope métier sans exiger la publication Marketplace", () => {
  assert.ok(migration.includes("'public.naxa_caisse_actor_for_pharmacy(uuid)'::regprocedure"));
  assert.ok(migration.includes("'and ph.actif=true and ph.visible_recherche=true'"));
  assert.ok(migration.includes("'and ph.actif=true and ph.archivee_le is null'"));
  assert.ok(migration.includes("Le garde Caisse contient une condition de visibilité attendue absente"));
  assert.ok(sqlContract.includes("v_definition ilike '%visible_recherche%'"));
  assert.ok(sqlContract.includes("v_definition not ilike '%private.naxa_scope_allows%'"));
  assert.ok(sqlContract.includes("v_definition not ilike '%can_operate_pharmacy%'"));
});

test("le contrat Replay prouve le POS vendable sur une pharmacie active mais cachée", () => {
  assert.ok(sqlContract.includes("visible_recherche = false"));
  assert.ok(sqlContract.includes("ph.est_demo is true"));
  assert.ok(sqlContract.includes("private.naxa_pos_stock_vendable"));
  assert.ok(sqlContract.includes("v_quantity <= 0"));
  assert.ok(sqlContract.includes("rollback;"));
});

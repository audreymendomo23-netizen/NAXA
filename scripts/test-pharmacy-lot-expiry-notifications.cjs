"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261115100000_pharmacy_lot_expiry_reminders_and_cameroon_date_guard.sql"),
  "utf8"
);
const sqlTest = fs.readFileSync(
  path.join(root, "supabase/tests/20261115100000_pharmacy_lot_expiry_reminders_and_cameroon_date_guard.sql"),
  "utf8"
);
const stockUi = fs.readFileSync(
  path.join(root, "src/components/pharmacie/GestionnaireStockEspace.tsx"),
  "utf8"
);

test("rappels quotidiens J-30, J-15, J-7, J-3 et J0 selon Africa/Douala", () => {
  for (const offset of [30, 15, 7, 3, 0]) {
    assert.match(migration, new RegExp("\\b" + offset + "\\b"));
    assert.match(sqlTest, new RegExp("\\b" + offset + "\\b"));
  }
  assert.match(migration, /Africa\/Douala/);
  assert.match(migration, /0 6 \* \* \*/);
  assert.match(migration, /private\.dispatch_pharmacy_lot_expiry_alerts/);
});

test("destinataires limités au Promoteur du réseau, Responsable et Gestionnaire Stock actifs", () => {
  assert.match(migration, /promoteur_pharmacies[\s\S]*?promoter\.role::text='promoteur'/);
  assert.match(migration, /role_code in \('responsable','gestionnaire_stock'\)/);
  assert.match(migration, /a\.statut='active'/);
  assert.match(migration, /a\.commence_at<=now\(\)/);
  assert.match(migration, /a\.expire_at is null or a\.expire_at>now\(\)/);
  assert.doesNotMatch(migration, /role_code in \([^)]*'caisse'[^)]*\)/);
});

test("chaque seuil et destinataire est dédupliqué par lot, date et offset", () => {
  assert.match(migration, /unique \(lot_id,date_peremption,jours_avant,destinataire_id\)/i);
  assert.match(migration, /on conflict\(lot_id,date_peremption,jours_avant,destinataire_id\) do nothing/i);
  assert.match(migration, /'lot_expiry_reminder'/);
  assert.match(sqlTest, /v_second<>0/);
});

test("Marketplace et contrôles opérationnels utilisent la date locale du Cameroun", () => {
  assert.match(migration, /private\.naxa_date_cameroun\(\)/);
  assert.match(migration, /regexp_replace\(v_definition,'\\mcurrent_date\\M','private\.naxa_date_cameroun\(\)','g'\)/);
  assert.match(migration, /l\.date_peremption>=v_today/);
  assert.match(sqlTest, /date_peremption>=v_today/);
  assert.match(sqlTest, /v_marketplace_qty,-1\)<>50/);
  assert.match(sqlTest, /v_marketplace_qty,-1\)<>0/);
});

test("table privée, ACL et fixture transactionnelle annulée", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on private\.pharmacy_lot_expiry_notification_dispatches from public,anon,authenticated,service_role/i);
  assert.match(sqlTest, /begin;[\s\S]*rollback;/i);
  assert.match(sqlTest, /est_demo=false/);
  assert.match(sqlTest, /related_entity_id=any\(v_lot_ids\)/);
});

test("interface Lots & péremptions utilise la date civile Africa/Douala et non UTC", () => {
  assert.ok(stockUi.includes('timeZone:"Africa/Douala"'));
  assert.ok(stockUi.includes("dateDouala(new Date())"));
  assert.equal(stockUi.includes("toISOString().slice(0,10)"), false);
});

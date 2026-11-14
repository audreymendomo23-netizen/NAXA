const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const delivery = read("supabase/migrations/20261114003452_naxa_delivery_null_safe_payment_guards_20261114.sql");
const acl = read("supabase/migrations/20261114003821_naxa_security_public_projection_readonly_acl_20261114.sql");

test("livraison : préparation obligatoire et 18 index de support sont versionnés", () => {
  assert.match(delivery, /ALTER TABLE public\.reservations[\s\S]*ALTER COLUMN preparation_statut SET NOT NULL/i);
  assert.equal((delivery.match(/CREATE INDEX IF NOT EXISTS/g) || []).length, 18);
  assert.match(delivery, /naxa_delivery_events_pharmacie_time_idx/);
  assert.match(delivery, /naxa_delivery_payment_validated_by_idx/);
});

test("livraison : aucun mode de paiement nul ne franchit les points d'entrée", () => {
  for (const name of [
    "naxa_delivery_make_available",
    "naxa_delivery_accept",
    "naxa_delivery_my_missions",
    "naxa_delivery_pickup",
    "naxa_delivery_courier_declare_cash",
    "naxa_delivery_pos_encaisser",
    "gestionnaire_stock_commande_preparation",
    "naxa_delivery_make_available_before_preparation_gate",
    "naxa_delivery_driver_can_act"
  ]) {
    assert.ok(
      delivery.includes("FUNCTION public." + name) || delivery.includes("FUNCTION private." + name),
      name
    );
  }
  assert.match(delivery, /paiement_mode IS NULL/i);
  assert.match(delivery, /paiement_mode IS DISTINCT FROM/i);
  assert.match(delivery, /preparation_statut IS DISTINCT FROM 'prete_au_retrait'/i);
});

test("livraison : commission fixe et bornes métier NAXA préservées", () => {
  assert.match(delivery, /frais_livraison between 1500 and 3500/i);
  assert.match(delivery, /v_r\.frais_livraison,500,v_r\.frais_livraison-500/i);
});

test("ACL : projections en lecture seule et tables de suivi non accessibles à anon", () => {
  for (const name of ["marketplace_assureurs","marketplace_assurance_conventions","medicaments_cima_photos_public"]) {
    assert.match(acl, new RegExp("REVOKE ALL PRIVILEGES ON TABLE public\\." + name + " FROM PUBLIC, anon, authenticated, service_role", "i"));
    assert.match(acl, new RegExp("GRANT SELECT ON TABLE public\\." + name + " TO anon, authenticated, service_role", "i"));
  }
  assert.match(acl, /suivi_professional_weekly_availability FROM PUBLIC, anon/i);
  assert.match(acl, /suivi_professionals FROM PUBLIC, anon/i);
});
console.log("PASS — contrat des migrations de réconciliation Supabase NAXA.");

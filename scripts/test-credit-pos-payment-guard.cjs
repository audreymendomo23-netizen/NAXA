"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261116010200_credit_pos_payment_insert_fields_fix.sql"),
  "utf8",
);
const browser = fs.readFileSync(
  path.join(root, "scripts/e2e/verify-credit-pos-browser.cjs"),
  "utf8",
);

test("les métadonnées du paiement crédit sont écrites dès l'INSERT", () => {
  assert.match(migration, /case when p_mode='credit' then p_montant else null end/i);
  assert.match(migration, /monnaie_rendue\s*\n\s*\)\s*values\s*\([\s\S]*?0\s*\)/i);
  assert.match(migration, /insert into public\.vente_paiements\([\s\S]*?montant_percu,monnaie_rendue/i);
});

test("le finaliseur vérifie le paiement crédit sans UPDATE de vente_paiements", () => {
  const finalizer = migration.split("create or replace function public.vente_credit_finaliser")[1] || "";
  assert.match(finalizer, /vp\.montant_percu=v_vente\.total_net/i);
  assert.match(finalizer, /vp\.monnaie_rendue=0/i);
  assert.match(finalizer, /paiement POS crédit absent ou incomplet/i);
  assert.doesNotMatch(finalizer, /update\s+public\.vente_paiements/i);
});

test("le garde-fou POS conserve le refus des modifications directes", () => {
  assert.match(migration, /do not bypass it/i);
  assert.match(migration, /grant execute on function public\.vente_ajouter_paiement[\s\S]*to authenticated,service_role/i);
  assert.match(migration, /grant execute on function public\.vente_credit_finaliser[\s\S]*to authenticated,service_role/i);
  assert.doesNotMatch(migration, /create or replace function public\.naxa_guard_pos_payment_write/i);
});

test("la récupération d'une session approuvée restitue le stock par RPC audité et re-vérifie la quantité", () => {
  assert.match(browser, /gestionnaire_stock_quantite_ajuster/);
  assert.match(browser, /p_type:\s*"retour"/);
  assert.match(browser, /stockToRestore/);
  assert.match(browser, /quantity !== 4/);
  assert.match(browser, /Restitution contrôlée du stock après récupération/);
});

test("la recette expose le message métier de finalisation POS après approbation", () => {
  assert.match(browser, /Finalisation POS refusée après approbation Promoteur/);
  assert.match(browser, /message Caisse/);
  assert.match(browser, /état vente/);
});

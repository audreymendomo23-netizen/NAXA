"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const publication = fs.readFileSync(
  path.join(root, "supabase/migrations/20261115200000_pharmacy_owned_marketplace_product_publication.sql"),
  "utf8"
).toLowerCase();
const promoterScope = fs.readFileSync(
  path.join(root, "supabase/migrations/20261115202000_promoter_scope_and_zero_stock_catalogue_visibility.sql"),
  "utf8"
).toLowerCase();

test("les fiches du catalogue viennent des déclarations pharmacie, sans validation NAXA", () => {
  assert.match(publication, /new\.created_by := auth\.uid\(\)/);
  assert.match(promoterScope, /new\.created_by_pharmacie_id := v_pharmacie/);
  assert.match(promoterScope, /new\.source_fiche := 'declaration_pharmacie'/);
  assert.match(promoterScope, /new\.fiche_validee := false/);
  assert.doesNotMatch(publication, /new\.description := null/);
  assert.doesNotMatch(publication, /new\.indications := null/);
  assert.doesNotMatch(publication, /new\.synonymes := '\{\}'/);
});

test("les requêtes publiques affichent les fiches rattachées à une pharmacie réelle, même à stock nul", () => {
  assert.match(publication, /create policy produits_public_live_offer_read[\s\S]*?to anon[\s\S]*?marketplace_produit_visible/);
  assert.match(promoterScope, /create or replace function public\.marketplace_produit_visible/);
  assert.match(promoterScope, /from public\.stocks s[\s\S]*?ph\.actif is true[\s\S]*?ph\.visible_recherche is true[\s\S]*?ph\.est_demo is false/);
  assert.doesNotMatch(promoterScope.slice(promoterScope.indexOf("create or replace function public.marketplace_produit_visible"), promoterScope.indexOf("drop policy if exists produits_authenticated_live_offer_read")), /quantite\s*>\s*0/);
});

test("le Promoteur peut déclarer un produit uniquement dans son réseau actif", () => {
  assert.match(promoterScope, /'promoteur'/);
  assert.match(promoterScope, /private\.naxa_scope_allows\(v_user,p_pharmacie,'PHARMACIE'\)/);
  assert.match(promoterScope, /set_config\('naxa\.product_declaration_pharmacy',p_pharmacie::text,true\)/);
  assert.match(promoterScope, /new\.created_by_pharmacie_id := v_pharmacie/);
  assert.match(promoterScope, /naxa_promoteur_valide/);
});

test("le personnel pharmacie conserve l'édition sous contrôle du périmètre", () => {
  assert.match(promoterScope, /create policy produits_write[\s\S]*?naxa_scope_allows/);
  assert.match(promoterScope, /create policy produits_update[\s\S]*?naxa_scope_allows/);
  assert.match(promoterScope, /fiche_validee is not true/);
});

test("l'offre Marketplace ignore le drapeau de validation mais garde ses contrôles de vente", () => {
  assert.match(publication, /private\.marketplace_offre_stock_disponible_guarded/);
  assert.match(publication, /private\.search_pharmacies\(/);
  assert.match(publication, /private\.search_pharmacies_bulk\(/);
  assert.match(publication, /interval '48 hours'/);
  assert.match(publication, /public\.stocks_lots/);
  assert.match(publication, /public\.reservation_items/);
  assert.doesNotMatch(promoterScope, /fiche_validee is true/);
});

test("la fonction technique de visibilité ne publie pas les pharmacies démo", () => {
  assert.match(promoterScope, /ph\.est_demo is false/);
  assert.match(promoterScope, /ph\.archivee_le is null/);
  assert.match(promoterScope, /grant execute on function public\.marketplace_produit_visible\(uuid\)/);
});

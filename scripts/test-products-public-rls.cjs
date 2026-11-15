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

test("les nouvelles références sont déclarées par la pharmacie, sans validation NAXA", () => {
  assert.match(promoterScope, /new\.created_by := auth\.uid\(\)/);
  assert.match(promoterScope, /new\.created_by_pharmacie_id := v_pharmacie/);
  assert.match(promoterScope, /new\.source_fiche := 'declaration_pharmacie'/);
  assert.match(promoterScope, /new\.fiche_validee := false/);
  assert.doesNotMatch(promoterScope, /new\.description := null/);
  assert.doesNotMatch(promoterScope, /new\.indications := null/);
  assert.doesNotMatch(promoterScope, /new\.synonymes := '\{\}'/);
});

test("le catalogue public retrouve une référence pharmacie même avec quantité zéro", () => {
  assert.match(publication, /create policy produits_public_live_offer_read[\s\S]*?to anon[\s\S]*?marketplace_produit_visible/);
  const visibilityStart = promoterScope.indexOf("create or replace function public.marketplace_produit_visible");
  const visibilityEnd = promoterScope.indexOf("drop policy if exists produits_authenticated_live_offer_read", visibilityStart);
  const visibility = promoterScope.slice(visibilityStart, visibilityEnd);
  assert.match(visibility, /from public\.stocks s[\s\S]*?ph\.actif is true[\s\S]*?ph\.visible_recherche is true[\s\S]*?ph\.est_demo is false/);
  assert.doesNotMatch(visibility, /quantite\s*>\s*0/);
});

test("le Promoteur peut déclarer dans une pharmacie liée à son réseau, sans accès hors périmètre", () => {
  assert.match(promoterScope, /'promoteur'/);
  assert.match(promoterScope, /private\.naxa_scope_allows\(v_user,p_pharmacie,'pharmacie'\)/);
  assert.match(promoterScope, /set_config\('naxa\.product_declaration_pharmacy',p_pharmacie::text,true\)/);
  assert.match(promoterScope, /new\.created_by_pharmacie_id := v_pharmacie/);
  assert.match(promoterScope, /naxa_promoteur_valide/);
});

test("l'édition de fiche est limitée à la pharmacie déclarante", () => {
  assert.match(promoterScope, /create policy produits_write[\s\S]*?naxa_scope_allows/);
  assert.match(promoterScope, /create policy produits_update[\s\S]*?naxa_scope_allows/);
  assert.match(promoterScope, /fiche_validee is not true/);
  assert.doesNotMatch(promoterScope, /fiche_validee is true/);
});

test("la recherche d'offres ne dépend plus d'une validation NAXA", () => {
  assert.match(publication, /private\.marketplace_offre_stock_disponible_guarded/);
  assert.match(publication, /private\.search_pharmacies\(/);
  assert.match(publication, /private\.search_pharmacies_bulk\(/);
  assert.match(publication, /position\('fiche_validee' in v_definition\)>0/);
  assert.doesNotMatch(promoterScope, /fiche_validee is true/);
});

test("le partage public reste limité aux pharmacies actives, visibles et non démo", () => {
  assert.match(promoterScope, /ph\.actif is true/);
  assert.match(promoterScope, /ph\.visible_recherche is true/);
  assert.match(promoterScope, /ph\.est_demo is false/);
  assert.match(promoterScope, /ph\.archivee_le is null/);
  assert.match(publication, /grant execute on function public\.marketplace_produit_visible\(uuid\)/);
});

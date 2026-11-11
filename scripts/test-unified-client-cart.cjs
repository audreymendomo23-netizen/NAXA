const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const cart = read("src/lib/panier.tsx");
const grid = read("src/components/universes/UniverseProductGrid.tsx");
const basket = read("src/app/panier/page.tsx");
const medicationCheckout = read("src/app/commande/nouvelle/page.tsx");
const catalog = read("src/components/universes/UniverseCatalog.tsx");
const migration = read("supabase/migrations/20261112090000_unified_client_cart_catalog_owner.sql");

test("le panier principal conserve les métadonnées Bébé & Maman", () => {
  for (const field of ["type_article", "universe_product_id", "pharmacie_id", "pharmacie_nom", "prix_unitaire_fcfa", "photo_url"]) {
    assert.match(cart, new RegExp(field));
  }
  assert.match(cart, /MAX_LIGNES/);
  assert.match(cart, /MAX_QTE/);
});

test("Bébé & Maman rejoint le panier principal uniquement avec une pharmacie identifiée", () => {
  assert.match(grid, /ajouterAuPanierPrincipal/);
  assert.match(grid, /if \(!p\.pharmacie_id\)/);
  assert.match(grid, /type_article: "bebe-maman"/);
  assert.match(grid, /disabled=\{stock < 1 \|\| \(universe === "bebe-maman" && !p\.pharmacie_id\)\}/);
});

test("le classement Bébé & Maman reste neutre et sans tri par prix", () => {
  const start = grid.indexOf('id="universe-sort"');
  const select = grid.slice(start, grid.indexOf("</select>", start));
  assert.match(select, /universe !== "bebe-maman" && <>[\s\S]*price-asc[\s\S]*price-desc[\s\S]*<\/>/);
});

test("la page panier affiche séparément médicaments et Bébé & Maman", () => {
  assert.match(basket, /Bébé &amp; Maman/);
  assert.match(basket, /Médicaments/);
  assert.match(basket, /changerQuantite/);
  assert.match(basket, /retirer/);
});

test("le checkout médicaments exclut les lignes Bébé & Maman", () => {
  assert.match(medicationCheckout, /type_article.*bebe-maman/);
  assert.doesNotMatch(medicationCheckout, /const items=lignes\.map/);
});

test("le RPC catalogue expose l'identifiant de pharmacie sans modifier le RPC existant", () => {
  assert.match(catalog, /get_universe_catalog_for_cart/);
  assert.match(migration, /returns table\([\s\S]*pharmacie_id uuid/);
  assert.match(migration, /grant execute on function public\.get_universe_catalog_for_cart/);
  assert.doesNotMatch(migration, /drop function|cascade/i);
});

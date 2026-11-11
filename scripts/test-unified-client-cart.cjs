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
const migration = read("supabase/migrations/20261111233239_unified_client_cart_catalog_owner.sql");
const finalMigration = read("supabase/migrations/20261111234144_unified_client_cart_extend_public_catalog.sql");

test("le panier principal conserve les métadonnées Bébé & Maman", () => {
  for (const field of ["type_article", "universe_product_id", "pharmacie_id", "pharmacie_nom", "prix_unitaire_fcfa", "photo_url", "quantite_max"]) {
    assert.match(cart, new RegExp(field));
  }
  assert.match(cart, /MAX_LIGNES/);
  assert.match(cart, /MAX_QTE/);
  assert.match(cart, /quantite_max/);
  assert.match(grid, /quantite_max: max/);
  assert.match(basket, /line\.quantite_max \?\? MAX_QTE/);
});

test("Bébé & Maman rejoint le panier principal uniquement avec une pharmacie identifiée", () => {
  assert.match(grid, /const \{ ajouter: ajouterAuPanierPrincipal, lignes: panierPrincipal \} = usePanier\(\)/);
  assert.match(grid, /ajouterAuPanierPrincipal/);
  assert.match(grid, /cartError && universe === "bebe-maman"/);
  assert.match(grid, /x\.universe === "parapharmacie"/);
  assert.match(grid, /if \(!p\.pharmacie_id\)/);
  assert.match(grid, /type_article: "bebe-maman"/);
  assert.match(grid, /disabled=\{stock < 1 \|\| \(universe === "bebe-maman" && !p\.pharmacie_id\)\}/);
});

test("le classement Bébé & Maman reste neutre et sans tri par prix", () => {
  const start = grid.indexOf('id="universe-sort"');
  const select = grid.slice(start, grid.indexOf("</select>", start));
  const priceSort = select.indexOf('value="price-asc"');
  assert.ok(priceSort > 0 && select.lastIndexOf('universe !== "bebe-maman" && <>', priceSort) >= 0);
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

test("le RPC catalogue existant expose aussi l'identifiant de pharmacie", () => {
  assert.ok(catalog.includes('rpc("get_universe_catalog"'));
  assert.ok(finalMigration.includes("pharmacie_id uuid"));
  assert.ok(finalMigration.includes("drop function public.get_universe_catalog_for_cart(text)"));
  assert.ok(finalMigration.includes("grant execute on function public.get_universe_catalog(text)"));
  assert.ok(!finalMigration.toLowerCase().includes("cascade"));
});

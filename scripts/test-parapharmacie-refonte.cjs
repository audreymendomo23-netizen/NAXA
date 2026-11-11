const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const grid = fs.readFileSync(path.join(root, "src/components/universes/UniverseProductGrid.tsx"), "utf8");
const rules = fs.readFileSync(path.join(root, "src/lib/universe-product-rules.ts"), "utf8");
const actions = fs.readFileSync(path.join(root, "src/app/univers-actions.ts"), "utf8");
const catalog = fs.readFileSync(path.join(root, "src/components/universes/UniverseCatalog.tsx"), "utf8");

test("les deux univers partagent le gabarit photo 4:3 et les cartes descriptives", () => {
  assert.match(grid, /aspect-\[4\/3\]/);
  assert.match(grid, /object-contain p-3 sm:p-4/);
  assert.match(grid, /line-clamp-2 min-h-12/);
  assert.match(grid, /line-clamp-3 min-h-\[3\.75rem\]/);
  assert.match(grid, /Prix affiché par le partenaire/);
});

test("Parapharmacie conserve son identité turquoise et Bébé & Maman sa palette rose", () => {
  assert.match(grid, /accent: "#0B7F85"/);
  assert.match(grid, /soft: "#E6F7F6"/);
  assert.match(grid, /accent: "#C93774"/);
  assert.match(grid, /soft: "#FDEEF4"/);
  assert.match(grid, /bg-teal-100/);
  assert.match(grid, /bg-rose-100/);
});

test("les catégories sont filtrables par pastilles accessibles dans les deux univers", () => {
  assert.match(grid, /aria-label="Filtrer par catégorie"/);
  assert.match(grid, /aria-pressed=\{category === c\}/);
  assert.match(grid, /categories\.map\(c =>/);
  assert.doesNotMatch(grid, /id="universe-category"/);
});

test("recherche, tri et effacement des filtres restent disponibles", () => {
  assert.match(grid, /id="universe-search"/);
  assert.match(grid, /id="universe-sort"/);
  assert.match(grid, /Prix croissant/);
  assert.match(grid, /Prix décroissant/);
  assert.match(grid, /Effacer les filtres/);
});

test("les cartes affichent les informations factuelles utiles à la décision", () => {
  assert.match(grid, /universe === "bebe-maman" \? "Pharmacie" : "Professionnel Parapharmacie"/);
  assert.match(grid, /p\.partner_name/);
  assert.match(grid, /money\(Number\(p\.price_fcfa\)\)/);
  assert.match(grid, /\{stock\} disponible\(s\)/);
  assert.match(grid, /Ajouter au panier/);
});

test("l’exclusion des médicaments de Parapharmacie est conservée côté catalogue et serveur", () => {
  assert.match(grid, /return !isMedicationProduct\(p\)/);
  assert.match(rules, /export function isMedicationProduct/);
  assert.match(actions, /universe === "parapharmacie" && isMedicationProduct\(product\)/);
});

test("les réservations restent groupées par partenaire et univers", () => {
  assert.match(grid, /line\.partnerId \+ "\|" \+ line\.universe/);
  assert.match(grid, /reserverGroupeProduits/);
  assert.match(actions, /reserve_universe_products/);
  assert.match(catalog, /get_universe_catalog/);
});

test("l’affichage Bébé & Maman reste strictement neutre, sans publicité ni promotion", () => {
  assert.match(grid, /Aucun produit sponsorisé, classement publicitaire ni avantage promotionnel/);
});

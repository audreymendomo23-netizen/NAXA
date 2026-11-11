const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const library = fs.readFileSync(path.join(root, "src/components/universes/ProductImageLibrary.tsx"), "utf8");
const helper = fs.readFileSync(path.join(root, "src/lib/catalogue/product-image-library.ts"), "utf8");
const catalog = fs.readFileSync(path.join(root, "src/components/universes/UniverseCatalog.tsx"), "utf8");
const route = fs.readFileSync(path.join(root, "src/app/api/bibliotheque-images/route.ts"), "utf8");
const preview = fs.readFileSync(path.join(root, "src/components/universes/ProductImageLibraryPreview.tsx"), "utf8");
const home = fs.readFileSync(path.join(root, "src/components/AccueilClient.tsx"), "utf8");

test("la bibliothèque utilise la recherche officielle Open Beauty Facts avec cache quotidien", () => {
  assert.match(helper, /world\.openbeautyfacts\.org\/cgi\/search\.pl/);
  assert.match(helper, /User-Agent/);
  assert.match(helper, /next: \{ revalidate: 86400 \}/);
  assert.match(helper, /page_size/);
  assert.match(helper, /photographers_tags/);
});

test("les URL photo sont limitées au domaine d’images Open Beauty Facts en HTTPS", () => {
  assert.match(helper, /url\.protocol === "https:"/);
  assert.match(helper, /url\.hostname === "images\.openbeautyfacts\.org"/);
  assert.match(helper, /\/images\/products\//);
});

test("les images sont attribuées et la licence CC BY-SA est affichée", () => {
  assert.match(library, /Creative Commons Attribution/);
  assert.match(library, /CC BY-SA 3\.0/);
  assert.match(library, /Crédit photo/);
  assert.match(library, /Voir la fiche source/);
});

test("la bibliothèque reste informative, sans prix, stock, commande ni publicité", () => {
  assert.match(library, /ne représentent pas les stocks des pharmacies partenaires/);
  assert.match(library, /aucun prix, classement, placement sponsorisé ni incitation à l’achat/);
  assert.match(library, /ne prouve ni référencement local, ni stock, ni disponibilité/);
  assert.doesNotMatch(library, /Ajouter au panier|Commander|Prix FCFA|en stock/i);
  assert.match(preview, /sans prix, sans classement commercial et sans indication de stock/);
  assert.doesNotMatch(preview, /Ajouter au panier|Commander|Prix FCFA|en stock/i);
});

test("Bébé & Maman filtre les références autour du bébé et de la maternité", () => {
  assert.match(helper, /baby\|bébé\|bebe\|infant\|newborn/);
  assert.match(helper, /universe === "bebe-maman"/);
  assert.match(library, /aucun prix, classement, placement sponsorisé ni incitation à l’achat/);
});

test("la galerie est visible sur les vitrines Parapharmacie et Bébé & Maman", () => {
  assert.match(catalog, /<ProductImageLibrary universe=\{universe\}\s*\/>/);
});

test("l’aperçu de bibliothèque est intégré à l’accueil principal du client", () => {
  assert.match(route, /naxa-age-status-v2/);
  assert.match(route, /loadProductImageLibrary\("parapharmacie"\)/);
  assert.match(route, /loadProductImageLibrary\("bebe-maman"\)/);
  assert.match(preview, /\/api\/bibliotheque-images/);
  assert.match(home, /<ProductImageLibraryPreview \/>/);
  assert.match(preview, /Bibliothèque visuelle des produits/);
});

process.stdout.write("Bibliothèque visuelle et affichage principal vérifiés.\n");

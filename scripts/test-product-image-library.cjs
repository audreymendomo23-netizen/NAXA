const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const library = fs.readFileSync(path.join(root, "src/components/universes/ProductImageLibrary.tsx"), "utf8");
const catalog = fs.readFileSync(path.join(root, "src/components/universes/UniverseCatalog.tsx"), "utf8");

test("la bibliothèque utilise la recherche officielle Open Beauty Facts avec cache quotidien", () => {
  assert.match(library, /world\.openbeautyfacts\.org\/cgi\/search\.pl/);
  assert.match(library, /User-Agent/);
  assert.match(library, /next: \{ revalidate: 86400 \}/);
  assert.match(library, /page_size/);
  assert.match(library, /photographers_tags/);
});

test("les URL photo sont limitées au domaine d’images Open Beauty Facts en HTTPS", () => {
  assert.match(library, /url\.protocol === "https:"/);
  assert.match(library, /url\.hostname === "images\.openbeautyfacts\.org"/);
  assert.match(library, /\/images\/products\//);
});

test("les images sont attribuées et la licence CC BY-SA est affichée", () => {
  assert.match(library, /Creative Commons Attribution/);
  assert.match(library, /CC BY-SA 3\.0/);
  assert.match(library, /Crédit photo/);
  assert.match(library, /Voir la fiche source/);
});

test("la bibliothèque reste informative, sans prix, stock, commande ni publicité", () => {
  assert.match(library, /ne représente pas les stocks des pharmacies partenaires/);
  assert.match(library, /aucun prix, classement, placement sponsorisé ni incitation à l’achat/);
  assert.match(library, /ne prouve ni référencement local, ni stock, ni disponibilité/);
  assert.doesNotMatch(library, /Ajouter au panier|Commander|Prix FCFA|en stock/i);
});

test("Bébé & Maman filtre les références autour du bébé et de la maternité", () => {
  assert.match(library, /baby\|bébé\|bebe\|infant\|newborn/);
  assert.match(library, /universe === "bebe-maman"/);
});

test("la galerie est visible sur la vitrine principale uniquement si l’univers est activé", () => {
  assert.match(catalog, /featureFlag\?\.enabled === true/);
  assert.match(catalog, /<ProductImageLibrary universe=\{universe\} \/>/);
});

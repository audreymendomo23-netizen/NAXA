const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const home = read("src/app/admin/prestations/demandes/page.tsx");
const marketplace = read("src/app/admin/pilotage/reservations/page.tsx");
const offers = read("src/app/admin/prestations/page.tsx");
const pilotage = read("src/app/admin/pilotage/page.tsx");

test("la file Prestations est protégée par le garde Admin actif et lit la source canonique", () => {
  assert.match(home, /requireAdminActive\("\/admin\/prestations\/demandes"\)/);
  assert.match(home, /from\("home_service_requests"\)/);
  assert.match(home, /partners!inner/);
  assert.match(home, /count: "exact"/);
  assert.match(home, /limit\(100\)/);
});

test("la file Prestations ne lit aucune donnée privée et ne modifie aucun dossier", () => {
  assert.doesNotMatch(home, /exact_address|contact_phone|phone_private|address_private|client_note/);
  assert.doesNotMatch(home, /\.update\(|\.insert\(|\.delete\(|\.rpc\(/);
  assert.match(home, /lecture seule/);
});

test("la file Marketplace est protégée par le garde Admin actif et lit réservations, articles et pharmacies", () => {
  assert.match(marketplace, /requireAdminActive\("\/admin\/pilotage\/reservations"\)/);
  assert.match(marketplace, /from\("reservations"\)/);
  assert.match(marketplace, /reservation_items\(/);
  assert.match(marketplace, /reservation_events/);
  assert.match(marketplace, /pharmacies\(nom\)/);
  assert.match(marketplace, /count: "exact"/);
});

test("la file Marketplace n'expose ni secrets de paiement ni coordonnées et reste strictement en lecture", () => {
  assert.doesNotMatch(marketplace, /code_paiement|paiement_ref|telephone_livraison|adresse_livraison|repere_livraison/);
  assert.doesNotMatch(marketplace, /\.update\(|\.insert\(|\.delete\(|\.rpc\(/);
  assert.match(marketplace, /aucune mutation de stock, statut ou paiement/);
});

test("les deux files sont atteignables depuis les écrans Admin de référence", () => {
  assert.match(offers, /href="\/admin\/prestations\/demandes"/);
  assert.match(pilotage, /href="\/admin\/pilotage\/reservations"/);
});

process.stdout.write("Contrats statiques des files Admin vérifiés.\n");

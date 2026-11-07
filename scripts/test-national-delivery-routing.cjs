const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("géolocalisation nationale : le GPS sert au classement de toutes les pharmacies partenaires", () => {
  const api = read("src/app/api/pharmacies/proches/route.ts");
  const home = read("src/components/AccueilClient.tsx");
  assert.match(api, /est_demo", false/);
  assert.match(api, /\.range\(0, 4999\)/);
  assert.match(api, /calculerMatriceRoutiere/);
  assert.match(api, /googleMapsUrl/);
  assert.match(home, /api\/pharmacies\/proches\?lat=/);
  assert.doesNotMatch(home, /distanceKm <= 30/);
  assert.doesNotMatch(home, /NEXT_PUBLIC_NAXA_ROUTING_URL/);
});

test("devis livraison : calcul serveur, expirant et lié au compte et à la pharmacie", () => {
  const api = read("src/app/api/livraison/devis/route.ts");
  const migration = read("supabase/migrations/20261107240000_delivery_server_route_quotes_national_tariffs.sql");
  const checkout = read("src/app/commande/nouvelle/page.tsx");
  assert.match(api, /auth\.getUser/);
  assert.match(api, /calculerMatriceRoutiere/);
  assert.match(api, /naxa_delivery_quotes/);
  assert.match(api, /expire_le/);
  assert.match(migration, /before update of mode,latitude_livraison,longitude_livraison/);
  assert.match(migration, /q\.client_id=new\.client_id/);
  assert.match(migration, /q\.pharmacie_id=new\.pharmacie_id/);
  assert.match(migration, /q\.consomme_le is null/);
  assert.match(migration, /new\.frais_livraison := v_quote\.frais_livraison/);
  assert.match(checkout, /\/api\/livraison\/devis/);
  assert.match(checkout, /delivery_quote_id/);
  assert.doesNotMatch(checkout, /direct \* 1\.4/);
  assert.doesNotMatch(checkout, /calculerTrajet/);
});

test("Google Maps : l'itinéraire est universel et s'ouvre sur téléphone", () => {
  const routing = read("src/lib/server/delivery-routing.ts");
  const map = read("src/components/CartePharmaciesProches.tsx");
  const quote = read("src/app/api/livraison/devis/route.ts");
  assert.match(routing, /https:\/\/www\.google\.com\/maps\/dir/);
  assert.match(routing, /searchParams\.set\("api", "1"\)/);
  assert.match(map, /Ouvrir l’itinéraire dans Google Maps/);
  assert.match(quote, /googleMapsUrl/);
  assert.match(routing, /GOOGLE_MAPS_ROUTES_API_KEY/);
  assert.doesNotMatch(routing, /NEXT_PUBLIC_GOOGLE_MAPS/);
});

test("aucune tarification livraison sur la distance à vol d'oiseau ou estimation de secours", () => {
  const routing = read("src/lib/server/delivery-routing.ts");
  const quote = read("src/app/api/livraison/devis/route.ts");
  assert.match(routing, /calculerTarifLivraison/);
  assert.match(quote, /calculerTarifLivraison\(km\)/);
  assert.match(quote, /Aucun tarif approximatif ne sera appliqué/);
});

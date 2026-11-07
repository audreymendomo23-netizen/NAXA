const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("géolocalisation nationale : le GPS sert au classement de toutes les pharmacies partenaires", () => {
  const api = read("src/app/api/pharmacies/proches/route.ts");
  const home = read("src/components/AccueilClient.tsx");
  assert.match(api, /est_demo", false/);
  assert.match(api, /\.range\(offset, offset \+ 999\)/);
  assert.match(api, /offset < 50000/);
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

test("le client ne voit que le montant total de livraison, sans détail de distance ni de commission", () => {
  const checkout = read("src/app/commande/nouvelle/page.tsx");
  assert.match(checkout, /Frais de livraison : \{deliveryFee\.toLocaleString/);
  assert.doesNotMatch(checkout, /Distance routière calculée/);
  assert.doesNotMatch(checkout, /commission_naxa|commissionNaxa|commission NAXA/i);
  assert.doesNotMatch(checkout, /Tarif minimum 1 500 FCFA/);
  assert.doesNotMatch(checkout, /Voir le trajet dans Google Maps/);
});

test("aucune tarification livraison sur la distance à vol d'oiseau ou estimation de secours", () => {
  const routing = read("src/lib/server/delivery-routing.ts");
  const quote = read("src/app/api/livraison/devis/route.ts");
  assert.match(routing, /calculerTarifLivraison/);
  assert.match(quote, /calculerTarifLivraison\(km\)/);
  assert.match(quote, /Aucun tarif approximatif ne sera appliqué/);
});


test("localités camerounaises : les homonymes exigent un choix explicite", () => {
  const api = read("src/app/api/geolocalisation/recherche/route.ts");
  const page = read("src/app/resultats/page.tsx");
  assert.match(api, /from\("localites_cameroun"\)/);
  assert.match(api, /status: 409/);
  assert.match(api, /candidates/);
  assert.match(page, /locationCandidates/);
  assert.match(page, /choisirLocalite/);
});

test("le Livreur reçoit les coordonnées nécessaires à sa prochaine étape uniquement après acceptation", () => {
  const migration = read("supabase/migrations/20261107280000_delivery_driver_google_maps_navigation.sql");
  const courier = read("src/components/pharmacie/LivreurWorkspaceClient.tsx");
  assert.match(migration, /'latitude_destination',case when m\.livreur_id=v_uid then r\.latitude_livraison else null end/);
  assert.match(migration, /'latitude_pharmacie',case when m\.livreur_id=v_uid then ph\.lat else null end/);
  assert.match(courier, /https:\/\/www\.google\.com\/maps\/dir/);
  assert.match(courier, /Itinéraire vers la pharmacie/);
  assert.match(courier, /Itinéraire vers le Client/);
});

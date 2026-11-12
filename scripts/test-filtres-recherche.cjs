const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "src/app/resultats/page.tsx"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261112050000_marketplace_assurance_search_read_models.sql"), "utf8");

test("GPS : aucune demande intrusive au chargement ; activation explicite du filtre Distance", () => {
  assert.match(page, /useState<"pending"\|"gps"\|"fallback">\("fallback"\)/);
  assert.doesNotMatch(page, /useEffect\(\(\)=>\{void actualiserPosition\(\)\}/);
  assert.match(page, /onClick=\{\(\)=>void activerDistance\(\)\}/);
  assert.match(page, /if\(locationStatus!=="gps"\)\{if\(await actualiserPosition\(\)\)/);
  assert.match(page, /La position GPS est nécessaire pour filtrer par distance/);
});

test("GPS : la position réelle détermine la ville et les coordonnées de recherche", () => {
  assert.match(page, /obtenirPositionGPS\(\)/);
  assert.match(page, /setCoords\(\{lat:position\.lat,lng:position\.lng\}\)/);
  assert.match(page, /setVilleFiltre\(villeGPS==="Douala"\|\|villeGPS==="Yaoundé"\?villeGPS:""\)/);
  assert.match(page, /Number\(r\.distance_km\)>Number\(rayonKm\)/);
});

test("Ville éloignée : le rayon RPC ne coupe pas Douala quand le GPS est à Yaoundé", () => {
  assert.match(page, /const pointRecherche=rayonKm&&locationStatus==="gps"\?coords:villeFiltre==="Douala"\?DOUALA:villeFiltre==="Yaoundé"\?YAOUNDE:coords/);
  assert.match(page, /const rayonRecherche=rayonKm&&locationStatus==="gps"\?Number\(rayonKm\):villeFiltre\?35:20/);
  assert.match(page, /distance_km:locationStatus==="gps"\?calculerDistanceKm\(coords\.lat,coords\.lng,r\.lat,r\.lng\):r\.distance_km/);
  assert.match(page, /p_lat:pointRecherche\.lat,p_lng:pointRecherche\.lng,p_rayon_km:rayonRecherche/);
  assert.match(page, /locationStatus,villeFiltre,rayonKm\]\)/);
});

test("Filtres : ville, rayon et assurances sont combinés sur les résultats réels", () => {
  assert.match(page, /normaliserTermeRecherche\(r\.ville\)!==normaliserTermeRecherche\(villeFiltre\)/);
  assert.match(page, /Number\(r\.distance_km\)>Number\(rayonKm\)/);
  assert.match(page, /assurancesSelectionnees\.some\(id=>r\.assureurIds\.includes\(id\)\)/);
  assert.match(page, /\[sorted,activeFilters,rxIds,rayonKm,villeFiltre,assurancesSelectionnees\]/);
});

test("Assurance : le catalogue utilise une vue publique minimale et les conventions valides", () => {
  assert.match(page, /from\("marketplace_assureurs"\)/);
  assert.match(page, /from\("marketplace_assurance_conventions"\)/);
  assert.match(migration, /where a\.actif = true/);
  assert.match(migration, /c\.statut = 'active'/);
  assert.match(migration, /c\.date_debut <= current_date/);
  assert.match(migration, /c\.date_fin >= current_date/);
  assert.match(migration, /p\.visible_recherche = true/);
  assert.match(migration, /p\.est_demo = false/);
  assert.doesNotMatch(migration, /reference_convention|cree_par/);
});

test("Assurance : les cinq assureurs de référence sont initialisés sans doublon", () => {
  for (const name of ["CNPS", "Activa", "Chanas Assurances", "Allianz", "SAAR Assurances"]) {
    assert.ok(migration.includes("'" + name + "'"), "Assureur absent : " + name);
  }
  assert.match(migration, /on conflict \(nom_normalise\).*do nothing/s);
});

test("Notifications : distance et prix sont calculés uniquement depuis les pharmacies filtrées", () => {
  assert.match(page, /const meilleureOffre=useMemo\(\(\)=>pharmaciesPanierComplet\.length/);
  assert.match(page, /\[\.\.\.filtered\]\.sort\(\(a,b\)=>Number\(a\.distance_km\)-Number\(b\.distance_km\)\)/);
  assert.match(page, /Math\.round\(Number\(nearest\.distance_km\)\*1000\)/);
  assert.match(page, /totalPrix\(meilleureOffre\)/);
  assert.match(page, /basketMode\|\|bulkTerms\.length\?/);
  assert.match(page, /notifierNAXA\(messages\.join\(" "\)\)/);
});

test("Panier multi-médicaments : les pharmacies partielles ne peuvent pas gagner le classement prix", () => {
  assert.match(page, /filtered\.filter\(r=>r\.trouves>=r\.demandes\)/);
  assert.match(page, /completeA=a\.trouves>=a\.demandes,completeB=b\.trouves>=b\.demandes/);
  assert.match(page, /Aucune pharmacie ne propose tous les médicaments demandés et leurs quantités/);
  assert.match(page, /Le panier complet demandé est le moins cher chez/);
});

test("Parcours panier et recherche groupée : le retour sans résultat est aussi explicite", () => {
  assert.match(page, /query\.trim\(\)\|\|basketMode\|\|bulkTerms\.length>0/);
  assert.match(page, /Aucune pharmacie partenaire ne correspond à tous les filtres sélectionnés/);
});

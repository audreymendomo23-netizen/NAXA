const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "src/app/resultats/page.tsx"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261112050000_marketplace_assurance_search_read_models.sql"), "utf8");
const migrationAssureurActif = fs.readFileSync(path.join(root, "supabase/migrations/20261112051000_marketplace_assurance_active_insurer_guard.sql"), "utf8");
const migrationRpcSecurity = fs.readFileSync(path.join(root, "supabase/migrations/20261112055000_public_search_rpc_security_hardening.sql"), "utf8");

test("GPS : aucune demande intrusive au chargement ; activation explicite du filtre Distance", () => {
  assert.match(page, /useState<"pending"\|"gps"\|"manual"\|"fallback">\("fallback"\)/);
  assert.doesNotMatch(page, /useEffect\(\(\)=>\{void actualiserPosition\(\)\}/);
  assert.match(page, /onClick=\{\(\)=>void activerDistance\(\)\}/);
  assert.match(page, /if\(locationStatus!=="gps"&&locationStatus!=="manual"\)\{if\(await actualiserPosition\(\)\)/);
  assert.match(page, /La position GPS est nécessaire pour filtrer par distance/);
});

test("GPS : la position réelle détermine la ville et les coordonnées de recherche", () => {
  assert.match(page, /obtenirPositionGPS\(\)/);
  assert.match(page, /setCoords\(\{lat:position\.lat,lng:position\.lng\}\)/);
  assert.match(page, /setVilleFiltre\(villeGPS==="Douala"\|\|villeGPS==="Yaoundé"\?villeGPS:""\)/);
  assert.match(page, /Number\(r\.distance_km\)>Number\(rayonKm\)/);
});

test("Ville éloignée : le rayon RPC ne coupe pas Douala quand le GPS est à Yaoundé", () => {
  assert.match(page, /const pointRecherche=villeFiltre==="Douala"\?DOUALA:villeFiltre==="Yaoundé"\?CENTRE_CAPITALE:coords\?\?CENTRE_CAMEROUN/);
  assert.match(page, /const rayonRecherche=rayonKm&&\(locationStatus==="gps"\|\|locationStatus==="manual"\)\?Number\(rayonKm\):villeFiltre\?35:2000/);
  assert.match(page, /distance_km:coords&&\(locationStatus==="gps"\|\|locationStatus==="manual"\)\?calculerDistanceKm\(coords\.lat,coords\.lng,r\.lat,r\.lng\):r\.distance_km/);
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
  assert.match(migration, /p\.archivee_le is null/);
  assert.match(migrationAssureurActif, /join public\.assureurs a on a\.id = c\.assureur_id and a\.actif = true/);
  assert.doesNotMatch(migration, /reference_convention|cree_par/);
});

test("RPC publics : accès anonyme via SECURITY DEFINER sans ouverture des tables internes", () => {
  assert.equal((migrationRpcSecurity.match(/language sql\s+stable\s+security definer\s+set search_path = ''/gi) ?? []).length, 2);
  assert.equal((migrationRpcSecurity.match(/set search_path = ''/gi) ?? []).length, 2);
  assert.match(migrationRpcSecurity, /extensions\.unaccent/);
  assert.match(migrationRpcSecurity, /extensions\.similarity/);
  assert.match(migrationRpcSecurity, /OPERATOR\(extensions\.%\)/);
  assert.match(migrationRpcSecurity, /ph\.visible_recherche is true/);
  assert.match(migrationRpcSecurity, /ph\.est_demo is false/);
  assert.match(migrationRpcSecurity, /ph\.archivee_le is null/);
  assert.match(migrationRpcSecurity, /grant execute on function public\.search_pharmacies\([\s\S]*to anon, authenticated/i);
  assert.match(migrationRpcSecurity, /grant execute on function public\.search_pharmacies_bulk\([\s\S]*to anon, authenticated/i);
  assert.doesNotMatch(migrationRpcSecurity, /grant select on public\.stocks/i);
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
  assert.match(page, /meilleureOffre\?totalPrix\(meilleureOffre\):""/);
  assert.match(page, /nearest\?Math\.round\(Number\(nearest\.distance_km\)\*1000\):""/);
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

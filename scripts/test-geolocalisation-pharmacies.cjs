const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.join(__dirname, "..", "supabase", "migration_071_geolocalisation_pharmacies_yaounde.sql");
const sql = fs.readFileSync(migrationPath, "utf8");

const rows = [...sql.matchAll(/^\s*\('((?:[^']|'')*)',\s*'Yaoundé',\s*'((?:[^']|'')*)',\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*'([^']+)',\s*'([^']+)'/gm)]
  .map((m) => ({
    name: m[1].replace(/''/g, "'"),
    quartier: m[2].replace(/''/g, "'"),
    lat: Number(m[3]),
    lng: Number(m[4]),
    category: m[5],
    source: m[6],
  }));

test("référentiel : au moins 10 pharmacies avec coordonnées sourcées", () => {
  assert.ok(rows.length >= 10, `Seulement ${rows.length} lignes de coordonnées détectées`);
  assert.ok(rows.every((row) => row.name.length > 2));
  assert.ok(rows.every((row) => /^https:\/\//.test(row.source)));
});

test("référentiel : coordonnées latitude/longitude dans les bornes valides", () => {
  for (const row of rows) {
    assert.ok(Number.isFinite(row.lat) && row.lat >= -90 && row.lat <= 90, `${row.name}: latitude invalide`);
    assert.ok(Number.isFinite(row.lng) && row.lng >= -180 && row.lng <= 180, `${row.name}: longitude invalide`);
    assert.ok(row.lat >= 3 && row.lat <= 4 && row.lng >= 11 && row.lng <= 12, `${row.name}: coordonnées hors de la zone attendue de Yaoundé`);
  }
});

test("référentiel : pharmacie vétérinaire séparée des pharmacies humaines", () => {
  const vet = rows.filter((row) => row.category === "pharmacie_veterinaire");
  assert.equal(vet.length, 1);
  assert.match(vet[0].name, /vétérinaire/i);
  assert.ok(rows.some((row) => row.category === "pharmacie_humaine"));
});

test("migration : aucune pharmacie partenaire n'est créée à partir d'un annuaire public", () => {
  assert.doesNotMatch(sql, /insert\s+into\s+(?:public\.)?pharmacies\s*\(/i);
  assert.match(sql, /lower\(unaccent\(trim\(ph\.nom\)\)\)\s*=\s*lower\(unaccent\(trim\(r\.nom_source\)\)\)/i);
  assert.match(sql, /geo_statut\s*=\s*'source_publique_a_confirmer'/i);
  assert.match(sql, /r\.categorie\s*=\s*'pharmacie_humaine'/i);
});

test("GPS navigateur : permission, précision et délai bornés", () => {
  const helper = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "geolocation.ts"), "utf8");
  assert.match(helper, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(helper, /enableHighAccuracy:\s*true/);
  assert.match(helper, /timeout:\s*12000/);
  assert.match(helper, /maximumAge:\s*60000/);
  assert.match(helper, /error\.code === 1 \? "refusee"/);
  assert.match(helper, /error\.code === 2 \? "introuvable"/);
  assert.match(helper, /error\.code === 3 \? "timeout"/);
  assert.match(helper, /lat < -90 \|\| lat > 90 \|\| lng < -180 \|\| lng > 180/);
});

test("GPS et localité manuelle : recherche nationale sans repli implicite vers Yaoundé", () => {
  const helper = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "geolocation.ts"), "utf8");
  const page = fs.readFileSync(path.join(__dirname, "..", "src", "app", "resultats", "page.tsx"), "utf8");
  const geocoder = fs.readFileSync(path.join(__dirname, "..", "src", "app", "api", "geolocalisation", "recherche", "route.ts"), "utf8");
  assert.match(helper, /villeDepuisPosition/);
  assert.match(page, /api\/geolocalisation\/recherche\?q=/);
  assert.match(page, /Utiliser le GPS/);
  assert.match(page, /Ville ou localité au Cameroun/);
  assert.match(page, /setCoords\(null\)/);
  assert.doesNotMatch(page, /useState\("Yaoundé"\)/);
  assert.doesNotMatch(page, /YAOUNDE/);
  assert.match(geocoder, /countrycodes", "cm"/);
  assert.match(geocoder, /address\?\.country_code\?\.toLowerCase\(\) !== "cm"/);
  assert.match(geocoder, /revalidate: 86400/);
  assert.match(geocoder, /waitForGlobalGeocoderSlot/);
  assert.match(geocoder, /naxa_reserve_api_rate_limit/);
  assert.match(geocoder, /p_interval_ms: 1000/);
  assert.doesNotMatch(geocoder, /lastRequestAt|requestQueue/);
  assert.doesNotMatch(geocoder, /autocomplete/i);
  assert.doesNotMatch(page, /watchPosition\s*\(/);
  assert.doesNotMatch(page, /localStorage\.setItem\([^\n]*(?:lat|lng|position|coord)/i);
});

test("OpenStreetMap : référentiel national, authentification admin et rapprochement prudent", () => {
  const route = fs.readFileSync(path.join(__dirname, "..", "src", "app", "api", "admin", "geolocalisation-osm", "route.ts"), "utf8");
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /rpc\("is_admin"\)/);
  assert.match(route, /ISO3166-1.*CM/);
  assert.match(route, /CAMEROON_LAT/);
  assert.match(route, /byNameAndCity/);
  assert.match(route, /normaliserNom\(pharmacy\.ville\)/);
  assert.doesNotMatch(route, /YAOUNDE_BBOX/);
  assert.doesNotMatch(route, /\.ilike\("ville", "%Yaound%"/);
  assert.match(route, /pharmacies_geo_osm_sync/);
  assert.match(route, /24 \* 60 \* 60 \* 1000/);
  assert.match(route, /onConflict: "nom_source,source_url"/);
  assert.match(route, /source_publique_a_confirmer/);
  assert.match(route, /© OpenStreetMap contributors/);
  assert.doesNotMatch(route, /from\("pharmacies"\)\.insert/);
});

test("OpenStreetMap : rapprochement exact seulement et préservation des coordonnées existantes", () => {
  const route = fs.readFileSync(path.join(__dirname, "..", "src", "app", "api", "admin", "geolocalisation-osm", "route.ts"), "utf8");
  assert.match(route, /normaliserNom\(pharmacy\.nom\)/);
  assert.match(route, /pharmacy\.lat !== null \|\| pharmacy\.lng !== null/);
  assert.match(route, /\.is\("lat", null\)\.is\("lng", null\)/);
  assert.match(route, /pharmaciesPartenairesRapprochees/);
  assert.match(route, /healthcare === "veterinary"/);
  assert.match(route, /candidats ne sont pas des partenaires NAXA/);
});

test("Migration OSM : état de synchronisation sécurisé et additif", () => {
  const migration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migration_072_geolocalisation_osm.sql"), "utf8");
  assert.match(migration, /create table if not exists public\.pharmacies_geo_osm_sync/i);
  assert.match(migration, /last_started_at timestamptz/i);
  assert.match(migration, /grant all on public\.pharmacies_geo_osm_sync to service_role/i);
  assert.match(migration, /revoke all on public\.pharmacies_geo_osm_sync from anon, authenticated/i);
  assert.match(migration, /alter table public\.pharmacies_geolocalisation_referentiel enable row level security/i);
  assert.doesNotMatch(migration, /drop table|delete from public\.pharmacies/i);
});

test("Interface admin : synchronisation explicite, sans lancement automatique", () => {
  const page = fs.readFileSync(path.join(__dirname, "..", "src", "app", "admin", "geolocalisation", "page.tsx"), "utf8");
  assert.match(page, /Synchroniser OpenStreetMap/);
  assert.match(page, /method: "POST"/);
  assert.match(page, /fetch\("\/api\/admin\/geolocalisation-osm", \{ cache: "no-store" \}\)/);
  assert.match(page, /candidats de l’annuaire ne deviennent jamais des partenaires NAXA/);
  assert.match(page, /OpenStreetMap contributors/);
  assert.doesNotMatch(page, /useEffect\(\(\)\s*=>\s*\{\s*void synchroniser\(\)/);
});


test("Carte OSM : repères GPS réels, liste stable et aucun stock exposé", () => {
  const dashboard = fs.readFileSync(path.join(__dirname, "..", "src", "components", "AccueilClient.tsx"), "utf8");
  const map = fs.readFileSync(path.join(__dirname, "..", "src", "components", "CartePharmaciesProches.tsx"), "utf8");
  assert.match(dashboard, /<CartePharmaciesProches pharmacies=\{pharmaciesProches\.map\(pharmacie\s*=>/);
  assert.match(dashboard, /\)\} position=\{coord\} onLocaliser=\{localiser\}/);
  assert.match(map, /tileLayer\("https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png"/);
  assert.match(map, /const pharmaciesAvecGPS = useMemo/);
  assert.match(map, /pharmacies\.filter\(p => p\.lat != null && p\.lng != null/);
  assert.match(map, /const markersRef = useRef<LeafletLayer\[\]>\(\[\]\)/);
  assert.match(map, /markersRef\.current\.push\(marker\)/);
  assert.match(map, /markersRef\.current\.forEach\(marker => marker\.remove\(\)\)/);
  assert.match(map, /map\.fitBounds/);
  assert.match(map, /Carte des repères des pharmacies partenaires, sans fiches détaillées/);
  assert.match(map, /aucun stock n’est présenté/);
  assert.match(map, /pharmaciesAvecContact\.map\(p =>/);
  assert.match(map, /<article key=\{p\.id\}/);
  assert.match(map, /© OpenStreetMap/);
  assert.doesNotMatch(map, /from\("stocks"\)/);
  assert.doesNotMatch(map, /marker\.on\("click"/);
  assert.doesNotMatch(map, /Disponibilités connues/);
  assert.doesNotMatch(dashboard, /CarteIllustrative/);
  assert.doesNotMatch(dashboard, /liste complète des pharmacies à proximité sera bientôt disponible/);
});

test("Migration de géolocalisation : politiques RLS limitées aux administrateurs authentifiés", () => {
  const migration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migration_073_geolocalisation_rls_policy_scope.sql"), "utf8");
  assert.match(migration, /for select to authenticated\s+using \(public\.is_admin\(\)\)/i);
  assert.match(migration, /for insert to authenticated\s+with check \(public\.is_admin\(\)\)/i);
  assert.match(migration, /for update to authenticated\s+using \(public\.is_admin\(\)\)\s+with check \(public\.is_admin\(\)\)/i);
  assert.match(migration, /revoke all on public\.pharmacies_geolocalisation_referentiel from anon/i);
  assert.doesNotMatch(migration, /drop table|delete from public\.pharmacies/i);
});

test("Gardes nationales : dates, source et vérification requises sur toutes les régions", () => {
  const page = fs.readFileSync(path.join(__dirname, "..", "src", "app", "gardes", "page.tsx"), "utf8");
  assert.match(page, /garde_debut/);
  assert.match(page, /garde_fin/);
  assert.match(page, /garde_source_url/);
  assert.match(page, /garde_verifiee_le/);
  assert.match(page, /\.gte\("garde_verifiee_le", verificationMin\)/);
  assert.match(page, /\.order\("region"/);
  assert.match(page, /grouperParRegion/);
  assert.match(page, /Aucune garde NAXA confirmée en cours/);
  assert.doesNotMatch(page, /\.ilike\("ville", "%Yaound%"/);
  assert.match(page, /annuaire-medical\.cm\/fr\/pharmacies-de-garde/);
});

test("Administration des gardes : rôle actif, source HTTPS et périodes bornées", () => {
  const api = fs.readFileSync(path.join(__dirname, "..", "src", "app", "api", "admin", "gardes", "route.ts"), "utf8");
  const page = fs.readFileSync(path.join(__dirname, "..", "src", "app", "admin", "gardes", "page.tsx"), "utf8");
  const client = fs.readFileSync(path.join(__dirname, "..", "src", "components", "admin", "GardesAdminClient.tsx"), "utf8");
  assert.match(api, /auth\.getUser\(\)/);
  assert.match(api, /naxa_business_function/);
  assert.match(api, /profile\?\.role !== "admin"/);
  assert.match(api, /profile\.actif !== true/);
  assert.match(api, /sourceUrl\.protocol !== "https:"/);
  assert.match(api, /duration > maxDuration/);
  assert.match(api, /14 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(api, /garde_verifiee_le: new Date\(\)\.toISOString\(\)/);
  assert.match(api, /garde_source_url: sourceUrl\.toString\(\)/);
  assert.match(api, /est_demo/,);
  assert.match(page, /requireAdminActive/);
  assert.match(client, /timeZone: "Africa\/Douala"/);
  assert.match(client, /Publier et vérifier/);
  assert.match(client, /Retirer la garde/);
  assert.match(client, /api\/admin\/gardes/);
});

test("Géocodage : limite globale atomique et fonction réservée au serveur", () => {
  const migration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20261107180000_naxa_shared_geocoder_rate_limit.sql"), "utf8");
  assert.match(migration, /create table if not exists public\.naxa_api_rate_limits/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.naxa_api_rate_limits from public, anon, authenticated/);
  assert.match(migration, /create or replace function public\.naxa_reserve_api_rate_limit/);
  assert.match(migration, /for update/);
  assert.match(migration, /grant execute on function public\.naxa_reserve_api_rate_limit/);
  assert.match(migration, /to service_role/);
});

test("Accueil gardes : réseau NAXA national uniquement, périodes confirmées et tri par distance", () => {
  const api = fs.readFileSync(path.join(__dirname, "..", "src", "app", "api", "pharmacies", "gardes", "route.ts"), "utf8");
  const home = fs.readFileSync(path.join(__dirname, "..", "src", "components", "AccueilClient.tsx"), "utf8");
  assert.match(api, /\.eq\("est_demo", false\)/);
  assert.match(api, /\.eq\("de_garde", true\)/);
  assert.match(api, /\.lte\("garde_debut", nowIso\)/);
  assert.match(api, /\.gt\("garde_fin", nowIso\)/);
  assert.match(api, /\.gte\("garde_verifiee_le", verificationMin\)/);
  assert.match(api, /\.order\("region"/);
  assert.doesNotMatch(api, /chargerGardesMfasha|mfasha\.com/);
  assert.doesNotMatch(api, /illustration|creerIllustrationPharmacie/);
  assert.match(home, /gardesTriees/);
  assert.match(home, /distance\(coord\.lat, coord\.lng, a\.lat, a\.lng\)/);
  assert.doesNotMatch(home, /pharmaciesProches\.filter\(p => p\.de_garde\)/);
  assert.match(home, /annuaire-medical\.cm\/fr\/pharmacies-de-garde/);
  assert.doesNotMatch(home, /mboapharma\.cm\/single-location-3\/yaounde/);
});

test("Accueil public : l'échec GPS ne prétend plus utiliser Yaoundé par défaut", () => {
  const page = fs.readFileSync(path.join(__dirname, "..", "src", "app", "page.tsx"), "utf8");
  const dictionary = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "accueil-textes.ts"), "utf8");
  assert.match(page, /setPosition\("indisponible"\)/);
  assert.match(page, /t\.localisationIndisponible/);
  assert.doesNotMatch(page, /yaoundeDefaut/);
  assert.doesNotMatch(dictionary, /Yaoundé par défaut|Yaoundé by default/);
  assert.match(dictionary, /Position non disponible/);
  assert.match(dictionary, /Location unavailable/);
});

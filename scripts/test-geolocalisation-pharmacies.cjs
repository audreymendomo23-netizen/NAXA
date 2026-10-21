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

test("GPS : Yaoundé et Douala ont des replis explicites, sans suivi permanent", () => {
  const helper = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "geolocation.ts"), "utf8");
  const page = fs.readFileSync(path.join(__dirname, "..", "src", "app", "resultats", "page.tsx"), "utf8");
  assert.match(helper, /Yaoundé:\s*\{\s*lat:\s*3\.8480,\s*lng:\s*11\.5021\s*\}/);
  assert.match(helper, /Douala:\s*\{\s*lat:\s*4\.0511,\s*lng:\s*9\.7679\s*\}/);
  assert.match(page, /Actualiser GPS/);
  assert.match(page, /id="naxa-ville"/);
  assert.match(page, /Position approximative/);
  assert.doesNotMatch(page, /watchPosition\s*\(/);
  assert.doesNotMatch(page, /localStorage\.setItem\([^\n]*(?:lat|lng|position|coord)/i);
});

test("OpenStreetMap : endpoint administratif protégé et synchronisation limitée à Yaoundé", () => {
  const route = fs.readFileSync(path.join(__dirname, "..", "src", "app", "api", "admin", "geolocalisation-osm", "route.ts"), "utf8");
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /rpc\("is_admin"\)/);
  assert.match(route, /YAOUNDE_BBOX/);
  assert.match(route, /openstreetmap\.org/);
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
  assert.match(route, /Number\.isFinite\(pharmacy\.lat\).*Number\.isFinite\(pharmacy\.lng\)/s);
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

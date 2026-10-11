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

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "naxa-travel-taxi-"));
execFileSync("npx", [
  "tsc", "--target", "ES2020", "--module", "commonjs", "--moduleResolution", "node",
  "--skipLibCheck", "--outDir", temp,
  "src/lib/travel.ts", "src/lib/traffic.ts", "src/lib/taxi.ts", "src/lib/types.ts",
], { stdio: "inherit" });
const { calculerTrajet, lienItineraire } = require(path.join(temp, "travel.js"));
const { estimerTaxiFcfa, formaterFcfa } = require(path.join(temp, "taxi.js"));

test("trajet OSRM valide : distance et durée routières non estimées", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ routes: [{ distance: 5200, duration: 900 }] }) });
  try {
    const result = await calculerTrajet({ lat: 3.848, lng: 11.502 }, { lat: 3.86, lng: 11.51 }, 4);
    assert.equal(result.km, 5.2);
    assert.equal(result.estime, false);
    assert.ok(result.minutes >= 15);
  } finally { global.fetch = originalFetch; }
});

test("échec OSRM : repli approximatif marqué comme estimé", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error("service indisponible"); };
  try {
    const result = await calculerTrajet({ lat: 3.848, lng: 11.502 }, { lat: 3.86, lng: 11.51 }, 2);
    assert.equal(result.km, 2.8);
    assert.equal(result.estime, true);
    assert.ok(result.minutes >= 1);
  } finally { global.fetch = originalFetch; }
});

test("coordonnées invalides : repli contrôlé", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error("ne devrait pas être appelé"); };
  try {
    const result = await calculerTrajet({ lat: Number.NaN, lng: 11.5 }, { lat: 3.86, lng: 11.51 }, 3);
    assert.ok(Math.abs(result.km - 4.2) < 1e-9);
    assert.equal(result.estime, true);
  } finally { global.fetch = originalFetch; }
});

test("lien itinéraire encode les coordonnées", () => {
  const url = lienItineraire({ lat: 3.848, lng: 11.502 }, { lat: 3.86, lng: 11.51 });
  assert.match(url, /openstreetmap\.org\/directions/);
  assert.match(url, /3.848%2C11.502%3B3.86%2C11.51/);
});

test("tarif taxi : bornes cohérentes et entrées anormales maîtrisées", () => {
  for (const distance of [0, 0.5, 5, 25, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
    const estimate = estimerTaxiFcfa(distance);
    assert.ok(estimate.minimumFcfa >= 0);
    assert.ok(estimate.maximumFcfa >= estimate.minimumFcfa);
    assert.equal(estimate.indicative, true);
  }
  assert.equal(formaterFcfa(1500), "1 500 FCFA");
});

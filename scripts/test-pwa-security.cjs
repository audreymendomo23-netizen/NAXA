const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const nextConfig = fs.readFileSync(path.join(root, "next.config.mjs"), "utf8");
const serwistConfig = fs.readFileSync(path.join(root, "serwist.config.js"), "utf8");
const layout = fs.readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
const worker = fs.readFileSync(path.join(root, "worker/sw.ts"), "utf8");

test("la PWA utilise Serwist maintenu et retire next-pwa/Workbox legacy", () => {
  assert.equal(pkg.dependencies["@serwist/next"], "9.5.13");
  assert.equal(pkg.dependencies.serwist, "9.5.13");
  assert.equal(pkg.devDependencies["@serwist/cli"], "9.5.13");
  assert.equal(pkg.devDependencies.esbuild, "0.28.2");
  assert.equal(pkg.dependencies["@ducanh2912/next-pwa"], undefined);
  assert.match(pkg.scripts.build, /next build && serwist build/);
  assert.match(nextConfig, /reactStrictMode: true/);
  assert.match(serwistConfig, /@serwist\/next\/config/);
  assert.match(serwistConfig, /swSrc: "worker\/sw\.ts"/);
  assert.match(serwistConfig, /swDest: "public\/sw\.js"/);
  assert.match(serwistConfig, /precachePrerendered: false/);
  assert.match(serwistConfig, /additionalPrecacheEntries/);
  assert.match(serwistConfig, /url: "\/offline\.html"/);
  assert.match(layout, /SerwistProvider swUrl="\/sw\.js"/);
  assert.match(worker, /new Serwist\(/);
});

test("les caches navigation n'acceptent que les routes publiques déclarées", () => {
  assert.match(worker, /publicNavigationPaths = new Set/);
  assert.match(worker, /publicNavigationPaths\.has\(url\.pathname\)/);
  assert.doesNotMatch(worker, /url\.pathname\.startsWith\("\/pharmacie|url\.pathname\.startsWith\("\/admin/);
  assert.doesNotMatch(worker, /request\.url\.includes\("\/api\//);
});

test("aucun cache API ni stockage privé Supabase n'est configuré", () => {
  assert.doesNotMatch(worker, /NetworkFirst\([\s\S]{0,120}\/api\//);
  assert.match(worker, /url\.pathname\.includes\("\/storage\/v1\/object\/public\/"\)/);
  assert.doesNotMatch(worker, /storage\/v1\/object\/sign/);
  assert.match(worker, /CacheableResponsePlugin\(\{ statuses: \[200\] \}\)/);
});

test("l'écran hors ligne est précaché et les caches privés historiques sont supprimés", () => {
  assert.match(serwistConfig, /additionalPrecacheEntries/);
  assert.match(serwistConfig, /\/offline\.html/);
  assert.match(worker, /url: "\/offline\.html"/);
  assert.match(worker, /naxa-pharmacy-login-v4/);
  assert.match(worker, /naxa-navigation-v4/);
});
process.stdout.write("Contrat PWA NAXA/Serwist vérifié.\n");

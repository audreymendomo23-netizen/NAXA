const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const helperSource = fs.readFileSync(path.join(root, "src/lib/cameroon-datetime.ts"), "utf8");
const panelSource = fs.readFileSync(path.join(root, "src/components/PartnerUniversePaymentPanel.tsx"), "utf8");
const compiled = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const mod = { exports: {} };
new Function("module", "exports", compiled.outputText)(mod, mod.exports);
const { isoToCameroonDateTime } = mod.exports;

test("SMS UTC converti en heure locale Africa/Douala", () => {
  assert.equal(isoToCameroonDateTime("2026-07-31T18:50:11.000Z"), "2026-07-31T19:50");
});

test("conversion gère le passage au jour suivant à Douala", () => {
  assert.equal(isoToCameroonDateTime("2026-07-31T23:30:00.000Z"), "2026-08-01T00:30");
});

test("date SMS invalide rejetée", () => {
  assert.throws(() => isoToCameroonDateTime("not-a-date"), /Date et heure du SMS invalides/);
});

test("le formulaire Partenaire utilise la conversion locale sur l'horodatage extrait", () => {
  assert.match(panelSource, /import \{ isoToCameroonDateTime \} from "@\/lib\/cameroon-datetime"/);
  assert.match(panelSource, /setPaidAt\(isoToCameroonDateTime\(parsed\.occurredAt\)\)/);
});

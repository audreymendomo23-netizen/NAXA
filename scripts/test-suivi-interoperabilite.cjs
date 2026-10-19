const fs = require("node:fs");
const assert = require("node:assert/strict");

const component = fs.readFileSync("src/components/suivi/SuiviConnecte.tsx", "utf8");
const cron = fs.readFileSync("src/app/api/cron/posologie/route.ts", "utf8");
const migration = fs.readFileSync("supabase/migration_148_suivi_21_dispositifs_interoperabilite.sql", "utf8");
const sqlTest = fs.readFileSync("supabase/tests/148_suivi_21_dispositifs_interoperabilite.sql", "utf8");
const measurementMigration = fs.readFileSync("supabase/migration_150_suivi_mesures_multidispositifs.sql", "utf8");
const measurementTest = fs.readFileSync("supabase/tests/150_suivi_mesures_multidispositifs.sql", "utf8");

const catalogKeys = [...component.matchAll(/\{ key:"([^"]+)", name:/g)].map(match => match[1]);
assert.equal(catalogKeys.length, 21, "le catalogue UI doit présenter exactement 21 dispositifs");
assert.equal(new Set(catalogKeys).size, 21, "les clés du catalogue doivent être uniques");
const measurementKeys = [...component.matchAll(/\{key:"([^"]+)",label:/g)].map(match => match[1]);
assert.equal(measurementKeys.length, 30, "30 types de mesure doivent être disponibles pour les appareils");
for (const key of [
  "tensiometre","thermometre","oxymetre","glucometre","balance",
  "capteur_cardiaque_bluetooth","podometre","ecg","spirometre","peak_flow",
  "balance_impedance","cholesterolometre","cetonemetre","uricometre",
  "montre_connectee","bracelet_activite","tracker_sommeil",
  "thermometre_infrarouge","capteur_respiration","pilulier_connecte","bouteille_hydratation"
]) assert.ok(catalogKeys.includes(key), "dispositif manquant: " + key);

assert.match(component, /createWorker\("fra\+eng"\)/, "OCR local français/anglais requis");
assert.match(component, /BarcodeDetector/, "détection de codes-barres/QR requise");
assert.match(component, /acceptAllDevices: true/, "détection Bluetooth multi-appareils requise");
assert.match(component, /service:"body_composition"/, "profil Bluetooth de balance impédancemètre manquant");
assert.match(component, /montre_connectee:/, "adaptateur de montre connectée manquant");
assert.match(component, /applyScannedValue/, "préremplissage contrôlé du scan manquant");
assert.match(component, /from\("naxa_push_subscriptions"\)\.upsert/, "inscription Push requise");
assert.match(component, /from\("suivi_reminders"\)/, "rappels persistants requis");
assert.match(cron, /\.from\("suivi_reminders"\)[\s\S]*?\.lte\("due_at", now\.toISOString\(\)\)/, "le cron doit détecter les rappels échus");
assert.match(cron, /eq\("family_key", family\)/, "le cron doit vérifier le consentement");
assert.match(cron, /webpush\.sendNotification\(subscription\.subscription, payload/, "le cron doit envoyer les notifications Push");
assert.match(cron, /\.eq\("due_at", originalDue\)[\s\S]*?\.maybeSingle\(\)/, "les échéances doivent être revendiquées atomiquement");
assert.match(migration, /'bouteille_hydratation'/, "migration doit couvrir le dernier dispositif");
assert.match(migration, /'manual','bluetooth','scan','hybrid'/, "migration doit autoriser les modes polyvalents");
assert.match(sqlTest, /naxa_148_device_interoperability_pass/, "test SQL de migration manquant");
assert.match(measurementMigration, /capacite_vitale/, "types de mesure étendus manquants");
assert.match(measurementTest, /naxa_150_extended_measurement_types_pass/, "test SQL des mesures étendues manquant");
assert.match(cron, /"cholesterol_ldl","capacite_vitale"/, "le moteur de rappels doit mapper les nouvelles familles");

console.log("PASS — 21 dispositifs, saisie/scan/Bluetooth, Push et rappels planifiés");

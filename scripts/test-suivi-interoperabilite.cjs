const fs = require("node:fs");
const assert = require("node:assert/strict");

const component = fs.readFileSync("src/components/suivi/SuiviConnecte.tsx", "utf8");
const deviceIllustrations = fs.readFileSync("src/components/suivi/DeviceIllustration.tsx", "utf8");
const universe = fs.readFileSync("src/components/universes/UniverseLanding.tsx", "utf8");
const cron = fs.readFileSync("src/app/api/cron/posologie/route.ts", "utf8");
const migration = fs.readFileSync("supabase/migration_148_suivi_21_dispositifs_interoperabilite.sql", "utf8");
const sqlTest = fs.readFileSync("supabase/tests/148_suivi_21_dispositifs_interoperabilite.sql", "utf8");
const measurementMigration = fs.readFileSync("supabase/migration_150_suivi_mesures_multidispositifs.sql", "utf8");
const measurementTest = fs.readFileSync("supabase/tests/150_suivi_mesures_multidispositifs.sql", "utf8");
const deviceSchemaMigration = fs.readFileSync("supabase/migrations/20261111000000_suivi_user_devices_catalog.sql", "utf8");
const nativeBleService = fs.readFileSync("android/app/src/main/java/cm/naxa/app/NaxaBleForegroundService.kt", "utf8");
const androidManifest = fs.readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
const nativeMainActivity = fs.readFileSync("android/app/src/main/java/cm/naxa/app/MainActivity.kt", "utf8");
const bootReceiver = fs.readFileSync("android/app/src/main/java/cm/naxa/app/NaxaBootReceiver.kt", "utf8");



const catalogKeys = [...component.matchAll(/\{ key:"([^"]+)", name:/g)].map(match => match[1]);
assert.equal(catalogKeys.length, 21, "le catalogue UI doit présenter exactement 21 dispositifs");
assert.equal(new Set(catalogKeys).size, 21, "les clés du catalogue doivent être uniques");
const measurementKeys = [...component.matchAll(/\{key:"([^"]+)",label:/g)].map(match => match[1]);
const expectedMeasurementKeys = [
  "tension_systolique", "tension_diastolique", "tension_arterielle_moyenne",
  "frequence_cardiaque", "temperature", "saturation_oxygene", "frequence_respiratoire",
  "glycemie", "poids", "taille", "imc", "cholesterol_total", "pas_jour",
  "activite_minutes", "hydratation_ml", "sommeil_heures", "douleur_score",
  "humeur_score", "cycle_jour", "medicament_pris", "symptome_note",
  "debit_expiratoire", "ecg_note", "masse_grasse", "masse_musculaire",
  "masse_osseuse", "cetonemie", "acide_urique", "cholesterol_hdl",
  "cholesterol_ldl", "capacite_vitale", "vitesse_course", "vitesse_cyclisme", "cadence_course",
  "longueur_foulee", "pourcentage_musculaire", "masse_maigre",
  "masse_maigre_molle", "masse_eau_corporelle", "metabolisme_basal"
];
assert.equal(measurementKeys.length, expectedMeasurementKeys.length,
  "le catalogue doit exposer les 40 types de mesure attendus");
assert.equal(new Set(measurementKeys).size, expectedMeasurementKeys.length,
  "les types de mesure doivent être uniques");
assert.deepEqual(measurementKeys, expectedMeasurementKeys,
  "les types de mesure doivent correspondre au contrat UI complet");
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
assert.ok(!component.includes("},12000);"), "un événement BLE natif ne doit jamais être acquitté par délai fixe");
assert.match(component, /detail\.acknowledge\?\.\(\)/, "l'acquittement BLE doit être explicite après traitement");
assert.match(component, /await sb\.from\("suivi_measurements"\)\.insert\(rows\)[\s\S]*?detail\.acknowledge\?\.\(\)/, "une mesure BLE ne doit être acquittée qu'après insertion serveur");
assert.match(component, /await enqueueSuiviMeasurements\(rows\)[\s\S]*?detail\.acknowledge\?\.\(\)/, "une mesure BLE hors ligne ne doit être acquittée qu'après stockage durable");
assert.match(nativeBleService, /AES\/GCM\/NoPadding/, "la file native BLE doit rester chiffrée AES-GCM");
assert.match(nativeBleService, /AndroidKeyStore/, "la clé de file BLE doit rester protégée par Android Keystore");
assert.match(nativeBleService, /queue\.length\(\) - 300/, "la file BLE native doit rester bornée");
assert.match(nativeBleService, /"queueOverflow"/, "un dépassement de file BLE doit produire un événement explicite");
assert.match(component, /detail\.type==="queueOverflow"/, "l'utilisateur doit être averti en cas de perte liée au débordement BLE");
assert.match(nativeBleService, /FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE/, "la connexion BLE Android doit utiliser le type connectedDevice");
assert.match(androidManifest, /android:foregroundServiceType="connectedDevice"/, "le manifeste doit déclarer le service BLE connecté");
assert.match(androidManifest, /\.NaxaBootReceiver/, "le manifeste doit déclarer le récepteur de redémarrage BLE");
assert.match(bootReceiver, /AuthRepository\(SecureTokenStore\(context\)\)\.restoreSession\(\)/, "la reprise au redémarrage doit revalider le compte côté serveur");
assert.match(bootReceiver, /owners\.contains\(profile\.userId\)/, "la reprise BLE doit être isolée au compte propriétaire");
assert.match(bootReceiver, /checkSelfPermission\(bluetoothPermission\) != PackageManager\.PERMISSION_GRANTED/, "la reprise au démarrage doit respecter l'autorisation Bluetooth Android");
assert.match(nativeBleService, /fun stopForLogout\(context: android\.content\.Context\)/, "une déconnexion doit pouvoir purger les sessions BLE persistées");
assert.match(nativeBleService, /fun savedSessionOwners\(context: android\.content\.Context\)/, "les propriétaires des sessions BLE doivent pouvoir être vérifiés");
assert.equal((nativeMainActivity.match(/NaxaBleForegroundService\.stopForLogout\(appContext\)/g) || []).length, 3, "les trois parcours de déconnexion doivent arrêter les sessions BLE");
assert.match(nativeBleService, /resumeSavedSessionsAfterAuth\(\)/, "un redémarrage du service doit revalider le compte avant reconnexion");
assert.match(nativeBleService, /private fun hasBleRuntimePermission\(\): Boolean/, "le service doit contrôler l'autorisation Bluetooth avant le foreground");
assert.match(nativeBleService, /if \(!hasBleRuntimePermission\(\)\) return START_NOT_STICKY/, "le service ne doit pas redémarrer sans permission Bluetooth");


assert.match(component, /\["body_composition","body_composition_measurement"\]/, "profil Bluetooth de balance impédancemètre manquant");
const bleProtocol = fs.readFileSync("src/lib/suivi/ble-protocols.js", "utf8");
assert.match(bleProtocol, /"body_composition"/, "service GATT Body Composition absent des services autorisés");
assert.match(bleProtocol, /body_composition: \{ service: "body_composition", characteristic: "body_composition_measurement" \}/, "décodeur Body Composition absent");
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
assert.ok(cron.includes('"cholesterol_ldl"].includes(type)') && cron.includes('"ecg_note","capacite_vitale"].includes(type)'), "le moteur de rappels doit mapper les nouvelles familles");
assert.match(component, /Mon suivi santé/, "le nouvel accueil doit être présent");
assert.match(component, /grid gap-5 sm:grid-cols-2 lg:grid-cols-3/, "les appareils doivent apparaître en grandes cartes photographiques responsives");
assert.match(component, /import \{ DeviceIllustration \} from "@\/components\/suivi\/DeviceIllustration"/, "le catalogue doit utiliser le composant d’illustration des dispositifs");
assert.match(component, /<DeviceIllustration deviceKey=\{device\.key\} label=\{"Illustration : "\+device\.name\}/, "chaque carte de dispositif doit afficher son image sémantique");
assert.match(deviceIllustrations, /const accessibleLabel = label \|\| deviceNames\[deviceKey\] \|\| "Dispositif de suivi"/, "un libellé accessible doit être calculé pour chaque illustration");
assert.match(deviceIllustrations, /role="img" aria-label=\{accessibleLabel\}/, "le libellé accessible doit être exposé au lecteur d’écran");
assert.match(deviceIllustrations, /alt=\{`Photo de référence — \$\{accessibleLabel\}`\}/, "les photos doivent avoir un texte alternatif explicite");
assert.match(deviceIllustrations, /<svg viewBox="0 0 300 300"/, "chaque illustration doit être un visuel SVG autonome");
const photoMapMatch = deviceIllustrations.match(/const DEVICE_PHOTOS:[\s\S]*?= \{([\s\S]*?)\n\};/);
assert.ok(photoMapMatch, "le catalogue photographique des dispositifs doit exister");
const photoEntries = [...photoMapMatch[1].matchAll(/^  ([a-z0-9_]+): \[(.*?)\]/gm)];
assert.equal(photoEntries.length, 21, "les 21 catégories doivent avoir une galerie");
assert.deepEqual(photoEntries.map(match => match[1]).sort(), [...catalogKeys].sort(), "les galeries doivent correspondre exactement aux catégories du catalogue");
for (const entry of photoEntries) {
  const category = entry[1];
  const sources = [...entry[2].matchAll(/"(\/images\/suivi-dispositifs\/[^"]+\.jpg)"/g)].map(match => match[1]);
  assert.ok(sources.length >= 1, "photo manquante pour " + category);
  for (const source of sources) {
    assert.ok(source.startsWith("/images/suivi-dispositifs/" + category + "/"), "une galerie ne doit jamais mélanger deux catégories : " + category + " / " + source);
    assert.ok(fs.existsSync("public" + source), "fichier photo introuvable : " + source);
  }
}
assert.match(deviceIllustrations, /setInterval\(advance, 4000\)/, "les modèles d'une même catégorie alternent toutes les 4 secondes");
assert.match(deviceIllustrations, /getGalleryPhase\(instanceId\)/, "chaque galerie possède son propre décalage");
assert.match(deviceIllustrations, /prefers-reduced-motion/, "la réduction des animations doit être respectée");
assert.ok(!deviceIllustrations.includes("<button") && !deviceIllustrations.includes("onClick"), "aucune flèche ni vignette de navigation");

const illustratedKeys = [...deviceIllustrations.matchAll(/^  ([a-z0-9_]+): "/gm)].map(match => match[1]);
assert.equal(illustratedKeys.length, 21, "21 illustrations dédiées doivent être disponibles");
assert.equal(new Set(illustratedKeys).size, 21, "les illustrations doivent avoir des clés uniques");
assert.ok(!component.includes("auto-cols-[76px]"), "l’ancien ruban de miniatures ne doit plus être affiché");
assert.match(universe, /Mon suivi santé connecté/, "l’univers ne doit plus présenter le suivi comme en préparation");
assert.match(deviceSchemaMigration, /create table if not exists public\.suivi_user_devices/, "la table personnelle doit être créée par une migration standard");
assert.match(deviceSchemaMigration, /enable row level security/, "RLS doit être activé sur les appareils personnels");
assert.match(deviceSchemaMigration, /suivi_has_consent/, "l’activation doit rester conditionnée au consentement");
assert.match(deviceSchemaMigration, /bouteille_hydratation/, "la migration doit couvrir les 21 catégories");

console.log("PASS — 21 dispositifs, saisie/scan/Bluetooth, Push et rappels planifiés");

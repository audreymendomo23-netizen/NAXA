const fs = require("node:fs");
const assert = require("node:assert/strict");
const { decodeStandardGattMeasurement } = require("../src/lib/suivi/ble-protocols");
const bleFrame = (...bytes) => new DataView(Uint8Array.from(bytes).buffer);
const decodeBle = (service, characteristic, bytes, deviceId) =>
  decodeStandardGattMeasurement(service, characteristic, bleFrame(...bytes), deviceId);



const hr = decodeBle("180D", "2A37", [0, 72]);
assert.equal(hr[0].measurement_type, "frequence_cardiaque");
assert.equal(hr[0].value_numeric, 72);
assert.equal(hr[0].unit, "bpm");

const bp = decodeBle("1810", "2A35", [0, 120, 0, 80, 0, 93, 0]);
assert.deepEqual(bp.map(value => value.value_numeric), [120, 80, 93]);
assert.deepEqual(bp.map(value => value.measurement_type), [
  "tension_systolique", "tension_diastolique", "tension_arterielle_moyenne"
]);

const temperature = decodeBle("1809", "2A1C", [0, 0x6d, 0x01, 0x00, 0xff]);
assert.equal(temperature[0].measurement_type, "temperature");
assert.equal(temperature[0].value_numeric, 36.5);

const weight = decodeBle("181D", "2A9D", [0, 70, 0]);
assert.equal(weight[0].measurement_type, "poids");
assert.equal(weight[0].value_numeric, 70);

const spotOximetry = decodeBle("1822", "2A5E", [0, 98, 0, 70, 0]);
assert.deepEqual(spotOximetry.map(value => value.measurement_type), ["saturation_oxygene", "frequence_cardiaque"]);
assert.deepEqual(spotOximetry.map(value => value.value_numeric), [98, 70]);

const continuousOximetry = decodeBle("1822", "2A5F", [
  0x1f, 98, 0, 70, 0, 99, 0, 72, 0, 96, 0, 68, 0,
  0, 0, 0, 0, 0, 0, 0
]);
assert.deepEqual(continuousOximetry.map(value => value.measurement_type), ["saturation_oxygene", "frequence_cardiaque"]);
assert.deepEqual(continuousOximetry.map(value => value.value_numeric), [98, 70]);


const bodyComposition = decodeBle("181B", "2A9C", [0, 0, 250, 0]);
assert.equal(bodyComposition[0].measurement_type, "masse_grasse");
assert.equal(bodyComposition[0].value_numeric, 25);

const glucose = decodeBle("1808", "2A18", [2, 1, 0, 0xe8, 0x07, 1, 1, 0, 0, 0, 12, 0xf0, 1, 1]);
assert.equal(glucose[0].measurement_type, "glycemie");
assert.equal(glucose[0].value_numeric, 1.2);
assert.equal(glucose[0].unit, "kg/L");
assert.equal(glucose[0].measured_at, "2024-01-01T00:00:00.000Z");

assert.throws(() => decodeBle("1810", "2A35", [0, 0xff, 0x07, 80, 0, 93, 0]), /SFLOAT/);


const running = decodeBle("1814", "2A53", [0, 0, 2, 90]);
assert.equal(running.find(value => value.measurement_type === "vitesse_course").value_numeric, 2);
assert.equal(running.find(value => value.measurement_type === "cadence_course").value_numeric, 90);

const bike = decodeBle("1826", "2AD2", [4, 0, 196, 9, 104, 1]);
assert.equal(bike.find(value => value.measurement_type === "vitesse_cyclisme").value_numeric, 25);
assert.equal(bike.find(value => value.measurement_type === "cadence_course").value_numeric, 180);

decodeBle("1816", "2A5B", [2, 10, 0, 0, 4], "fixture-bike");
const cycling = decodeBle("1816", "2A5B", [2, 11, 0, 0, 8], "fixture-bike");
assert.equal(cycling[0].measurement_type, "cadence_course");
assert.equal(cycling[0].value_numeric, 60);

assert.throws(() => decodeBle("180D", "2A37", [0]), /payload too short/);
assert.throws(() => decodeBle("180D", "2A37", [0, 0]), /supported range/);
assert.throws(() => decodeBle("FFFF", "FFFF", [0]), /No verified decoder/);

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
const nativeReminderReceiver = fs.readFileSync("android/app/src/main/java/cm/naxa/app/NaxaReminderReceiver.kt", "utf8");
const nativeSuiviRepository = fs.readFileSync("android/app/src/main/java/cm/naxa/app/SuiviBluetoothRepository.kt", "utf8");
const nativeGattDecoder = fs.readFileSync("android/app/src/main/java/cm/naxa/app/NaxaGattMeasurementDecoder.kt", "utf8");
const nativeGattUnitTests = fs.readFileSync("android/app/src/test/java/cm/naxa/app/NaxaGattMeasurementDecoderTest.kt", "utf8");
const nativeSyncWorker = fs.readFileSync("android/app/src/main/java/cm/naxa/app/NaxaBleMeasurementSyncWorker.kt", "utf8");
const nativeFamilyMapping = fs.readFileSync("android/app/src/main/java/cm/naxa/app/SuiviMeasurementFamilies.kt", "utf8");
const nativeFamilyUnitTests = fs.readFileSync("android/app/src/test/java/cm/naxa/app/SuiviMeasurementFamiliesTest.kt", "utf8");
const nativeAndroidBuild = fs.readFileSync("android/app/build.gradle.kts", "utf8");



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
assert.match(nativeBleService, /putString\(SESSIONS_KEY, encryptQueue\(array\.toString\(\)\)\)/, "les métadonnées des sessions BLE doivent être chiffrées au repos");
assert.match(nativeBleService, /decryptQueue\(prefs\.getString\(SESSIONS_KEY, null\)\)/, "les sessions BLE doivent être déchiffrées via la clé Android Keystore");
assert.match(nativeBleService, /QUEUE_CAPACITY = 300/, "la file BLE native doit rester bornée à 300 événements");
assert.match(nativeBleService, /if \(queue\.length\(\) >= QUEUE_CAPACITY\)/, "une file pleine doit refuser le nouvel événement au lieu d'éjecter un ancien");
assert.match(nativeBleService, /OVERFLOW_KEY = "queue_overflow"/, "le signal de débordement doit être conservé hors de la file des mesures");
assert.match(nativeBleService, /droppedMeasurementCount/, "le débordement doit comptabiliser séparément les mesures refusées");
assert.match(nativeBleService, /if \(!stored\) pauseAfterQueueOverflow\(\)/, "la collecte BLE doit être suspendue après le refus d'une mesure");
assert.match(nativeBleService, /fun pauseAfterQueueOverflow\(\)/, "la suspension de saturation doit être centralisée");
assert.match(nativeBleService, /events\.put\(overflow\)/, "le marqueur séparé doit rester visible au consommateur Compose");
assert.doesNotMatch(nativeBleService, /queue\.length\(\) - 299/, "aucun ancien événement ne doit être tronqué pour faire place au marqueur");
const queueEnqueueBlock = nativeBleService.match(/fun enqueueEvent\([\s\S]*?\n        fun pendingEvents/);
assert.ok(queueEnqueueBlock, "le chemin d'insertion BLE doit être présent");
assert.doesNotMatch(queueEnqueueBlock[0], /firstRetained|queue\.length\(\) - 299|removeAt\(/, "la saturation ne doit plus tronquer les événements déjà acceptés");
assert.match(queueEnqueueBlock[0], /putString\(OVERFLOW_KEY, encryptQueue\(markerQueue\.toString\(\)\)\)/, "le marqueur doit être durable sans consommer une place de mesure");
assert.match(nativeMainActivity, /val droppedMeasurements = event\.optInt\("droppedMeasurementCount", -1\)/, "l'interface native doit lire le compte des mesures refusées");
assert.match(nativeMainActivity, /File Bluetooth saturée\s*:[\s\S]*?Synchronisez puis reconnectez les appareils/, "l'interface native doit afficher la saturation et la reprise manuelle");
assert.match(component, /detail\.type==="queueOverflow"/, "l'utilisateur web doit rester averti en cas de perte liée au débordement BLE");
assert.match(nativeBleService, /FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE/, "la connexion BLE Android doit utiliser le type connectedDevice");
assert.match(nativeBleService, /"180A" to "2A29"[\s\S]*?"180A" to "2A24"[\s\S]*?"180A" to "2A26"[\s\S]*?"180F" to "2A19"/, "les informations fabricant/modèle/firmware et la batterie doivent être découvertes en GATT");
assert.match(androidManifest, /android:foregroundServiceType="connectedDevice"/, "le manifeste doit déclarer le service BLE connecté");
assert.match(androidManifest, /\.NaxaBootReceiver/, "le manifeste doit déclarer le récepteur de redémarrage BLE");
assert.match(bootReceiver, /AuthRepository\(SecureTokenStore\(context\)\)\.restoreSession\(\)/, "la reprise au redémarrage doit revalider le compte côté serveur");
assert.match(bootReceiver, /owners\.contains\(profile\.userId\)/, "la reprise BLE doit être isolée au compte propriétaire");
assert.match(bootReceiver, /checkSelfPermission\(bluetoothPermission\) != PackageManager\.PERMISSION_GRANTED/, "la reprise au démarrage doit respecter l'autorisation Bluetooth Android");
assert.match(nativeBleService, /fun stopForLogout\(context: android\.content\.Context\)/, "une déconnexion doit pouvoir purger les sessions BLE persistées");
assert.match(nativeBleService, /fun savedSessionOwners\(context: android\.content\.Context\)/, "les propriétaires des sessions BLE doivent pouvoir être vérifiés");
assert.equal((nativeMainActivity.match(/NaxaBleForegroundService\.stopForLogout\(appContext\)/g) || []).length, 3, "les trois parcours de déconnexion doivent arrêter les sessions BLE");
assert.match(nativeBleService, /resumeSavedSessionsAfterAuth\(\)/, "un redémarrage du service doit revalider le compte avant reconnexion");
assert.match(nativeBleService, /if \(profile == null\) \{\s*stopForLogout\(this@NaxaBleForegroundService\)/, "une session serveur invalide doit purger les liaisons BLE persistées");
assert.match(nativeBleService, /const val ACTION_SCAN = "cm\.naxa\.app\.BLE_SCAN"/, "le service Android doit exposer une action de découverte BLE");
assert.match(nativeBleService, /private fun hasBleScanPermission\(\): Boolean/, "la recherche BLE doit vérifier BLUETOOTH_SCAN ou la permission de localisation requise");
assert.match(nativeBleService, /scanner\.startScan\(null, ScanSettings\.Builder\(\)/, "la découverte BLE native doit lancer un scan GATT");
assert.match(nativeBleService, /"deviceFound"/, "les appareils découverts doivent être publiés dans la file d événements");
assert.match(nativeBleService, /handler\.postDelayed\(timeout, 12000L\)/, "la découverte BLE doit être bornée dans le temps");
assert.match(nativeMainActivity, /NativeSuiviBluetoothScreen\(/, "le parcours Bluetooth Android doit être rendu dans un écran Jetpack Compose");
assert.match(nativeMainActivity, /onOpenSuiviBluetooth/, "l’espace client natif doit permettre d’ouvrir le suivi connecté");
assert.match(nativeMainActivity, /RequestMultiplePermissions\(\)/, "les permissions BLE doivent être demandées par le flux Activity Result Compose");
assert.match(nativeMainActivity, /NaxaBleForegroundService\.requestScan\(context, ownerUserId\)/, "l’écran Compose doit déclencher le scan par le service BLE natif");
assert.match(nativeMainActivity, /NaxaBleForegroundService\.requestConnect\(context, device\.id, selectedDeviceKey, ownerUserId\)/, "l’écran Compose doit associer l’appareil via le service BLE natif");
assert.match(nativeMainActivity, /eventOwner != ownerUserId/, "l’écran Compose doit isoler les événements Bluetooth par compte");
assert.match(nativeMainActivity, /loadGrantedFamilies\(ownerUserId\)/, "le suivi Compose doit charger les consentements du compte avant le scan");
assert.match(nativeMainActivity, /selectedFamily in consentFamilies/, "le scan Bluetooth doit être bloqué sans consentement actif");
assert.match(nativeMainActivity, /setFamilyConsent\(ownerUserId, selectedFamily, true\)/, "le consentement doit être explicite et enregistré côté serveur");
assert.match(nativeMainActivity, /setFamilyConsent\(ownerUserId, selectedFamily, false\)/, "le retrait du consentement doit être disponible dans le parcours natif");
assert.match(nativeSuiviRepository, /rest\/v1\/rpc\/suivi_set_family_consent/, "le dépôt Android doit utiliser la RPC de consentement contrôlée côté serveur");
assert.match(nativeSuiviRepository, /Authorization", "Bearer \$token"/, "les appels de consentement natifs doivent utiliser la session Supabase du compte");
assert.match(nativeMainActivity, /enabled = device\.id !in connectedDevices && consentLoaded && selectedFamily in consentFamilies/, "l’association d’un appareil doit aussi être bloquée sans consentement actif");

assert.match(nativeGattDecoder, /fun decode\(serviceUuid: String, characteristicUuid: String, payloadHex: String, deviceId: String\)/, "le parcours Compose doit disposer d’un décodeur GATT Kotlin natif");
assert.match(nativeGattDecoder, /"180D" && characteristic == "2A37"/, "le décodeur natif doit couvrir la fréquence cardiaque standard");
assert.match(nativeGattDecoder, /"1810" && characteristic == "2A35"/, "le décodeur natif doit couvrir la tension artérielle standard");
assert.match(nativeGattDecoder, /"1809" && characteristic == "2A1C"/, "le décodeur natif doit couvrir la température standard");
assert.match(nativeGattDecoder, /"1822" && characteristic in setOf\("2A5E", "2A5F"\)/, "le décodeur natif doit couvrir les deux profils oxymètre");
assert.match(nativeGattDecoder, /"1808" && characteristic == "2A18"/, "le décodeur natif doit couvrir la glycémie standard");
assert.match(nativeGattDecoder, /"181D" && characteristic == "2A9D"/, "le décodeur natif doit couvrir la balance standard");
assert.match(nativeGattDecoder, /"181B" && characteristic == "2A9C"/, "le décodeur natif doit couvrir la composition corporelle standard");
assert.match(nativeSyncWorker, /NaxaGattMeasurementDecoder\.decode\(/, "le Worker Android doit décoder les trames BLE hors écran");
assert.match(nativeSyncWorker, /ensureNativeDevice\(/, "le Worker doit enregistrer l’appareil dans le catalogue Supabase");
assert.match(nativeSyncWorker, /persistNativeMeasurements[\s\S]*?acknowledgeEvents/, "l’ACK mesure doit suivre la persistance serveur");
assert.match(nativeSyncWorker, /eventOwner != ownerId/, "le Worker ne doit jamais réattribuer une mesure à un autre compte");
assert.match(nativeSyncWorker, /loadGrantedFamilies\(ownerId\)/, "le Worker doit relire les consentements côté serveur avant synchronisation");
assert.match(nativeSyncWorker, /setRequiredNetworkType\(NetworkType\.CONNECTED\)/, "le Worker doit attendre une connectivité réseau");
assert.match(nativeSyncWorker, /setBackoffCriteria\(BackoffPolicy\.EXPONENTIAL/, "le Worker doit réessayer avec backoff exponentiel");
assert.match(nativeSyncWorker, /ExistingWorkPolicy\.APPEND_OR_REPLACE/, "les nouveaux événements doivent rejoindre le travail en cours sans annuler la chaîne");
assert.match(nativeBleService, /scheduleMeasurementSync[\s\S]*?editor\.commit\(\)/, "la trame mesure doit être commitée durablement avant de programmer le Worker");
assert.match(nativeBleService, /NaxaBleMeasurementSyncWorker\.enqueue\(context\)/, "le service BLE doit programmer le Worker après chaque mesure");
assert.match(nativeMainActivity, /NaxaBleMeasurementSyncWorker\.enqueue\(context\)/, "l’ouverture du suivi doit relancer les mesures restées en attente");
assert.doesNotMatch(nativeMainActivity, /NaxaGattMeasurementDecoder\.decode\(/, "l’écran ne doit plus être le consommateur/synchroniseur des mesures");
assert.doesNotMatch(nativeMainActivity, /persistNativeMeasurements\(/, "la persistance ne doit pas dépendre du cycle de vie Compose");
assert.match(nativeAndroidBuild, /androidx\.work:work-runtime-ktx:2\.12\.0/, "WorkManager doit être une dépendance explicite Android");
assert.match(nativeFamilyMapping, /fun device\(deviceKey: String\)/, "le mapping consentement appareil doit être partagé");
assert.match(nativeFamilyMapping, /fun measurement\(type: String\)/, "le mapping consentement mesure doit être partagé");
assert.match(nativeFamilyUnitTests, /mapsDeviceCategoriesToTheirConsentFamily/);
assert.match(nativeFamilyUnitTests, /mapsPersistableMeasurementsToTheirConsentFamily/);
assert.match(nativeSuiviRepository, /"sync_origin", "android_native"/, "les mesures Android doivent être tracées comme android_native");
assert.match(nativeSuiviRepository, /"device_event_id", eventKeys\[index\]/, "chaque mesure doit avoir une clé d’événement stable");
assert.match(nativeSuiviRepository, /existing\.containsAll\(eventKeys\)/, "un conflit 409 ne doit être accepté qu’après vérification de tous les doublons");
assert.match(nativeGattUnitTests, /decodesHeartRateFromStandardGatt/);
assert.match(nativeGattUnitTests, /decodesBloodPressureIntoPersistableSystolicAndDiastolicValues/);
assert.match(nativeGattUnitTests, /decodesTemperatureAndOximetry/);
assert.match(nativeGattUnitTests, /decodesWeightAndBodyComposition/);
assert.match(nativeGattUnitTests, /rejectsMalformedAndUnknownFrames/);

assert.match(bootReceiver, /class NaxaBootReceiver : BroadcastReceiver\(\)/, "le récepteur de démarrage doit être déclaré une seule fois dans son fichier dédié");
assert.match(nativeReminderReceiver, /class NaxaReminderReceiver : AndroidBroadcastReceiver\(\)/, "le récepteur de rappels doit garder son propre type");
assert.doesNotMatch(nativeReminderReceiver, /class NaxaBootReceiver/, "aucune seconde déclaration de NaxaBootReceiver ne doit bloquer la compilation Kotlin");
assert.match(nativeBleService, /DEVICE_SERVICE_FILTERS/, "les profils GATT doivent être filtrés selon la catégorie choisie");
assert.match(nativeBleService, /if \(serviceId !in allowedServices && serviceId != "180A" && serviceId != "180F"\) continue/, "un appareil ne doit pas être accepté sur un profil GATT sans rapport avec sa catégorie");
assert.match(nativeBleService, /fun requestScan\(context: android\.content\.Context, ownerId: String\)/, "le service doit exposer une commande de scan au code Compose");
assert.match(nativeBleService, /fun requestConnect\(context: android\.content\.Context, address: String, deviceKey: String, ownerId: String\)/, "le service doit exposer une commande de connexion au code Compose");
assert.match(nativeBleService, /\.put\("ownerUserId", session\.ownerId\)/, "les événements GATT doivent porter le compte propriétaire");
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

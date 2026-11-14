# Audit global — Bluetooth NAXA

Date de travail : 14 novembre 2026
Branche : `main`
Statut : **VERT code + CI + SQL Production; ORANGE uniquement pour l'homologation BLE sur matériel physique**

## 1. Périmètre contrôlé

- Interface web de suivi : `src/components/suivi/SuiviConnecte.tsx`
- Décodeurs GATT : `src/lib/suivi/ble-protocols.js`
- Service Android : `android/app/src/main/java/cm/naxa/app/NaxaBleForegroundService.kt`
- Activité Android : `android/app/src/main/java/cm/naxa/app/MainActivity.kt`
- Récepteur de redémarrage : `android/app/src/main/java/cm/naxa/app/NaxaBootReceiver.kt`
- Test d'interopérabilité : `scripts/test-suivi-interoperabilite.cjs`
- Contrat de compatibilité : `docs/suivi-compatibilite-dispositifs.md`

## 2. Constat architectural bloquant

Le parcours web de suivi utilise l'API Web Bluetooth dans les navigateurs compatibles et conserve un adaptateur facultatif `window.NaxaAndroid`. L'APK Android utilise Jetpack Compose et ne doit pas dépendre de l'API Web Bluetooth du navigateur.

Le parcours Compose utilise le service BLE Android natif et ne dépend pas d'un pont WebView. Il charge le consentement avant le scan, vérifie la famille de l'appareil et chaque type de mesure, puis enregistre le périphérique dans `suivi_user_devices` via son identifiant de plateforme. Le décodeur Kotlin `NaxaGattMeasurementDecoder.kt` traite les profils GATT standards pris en charge. Les valeurs autorisées sont écrites dans `suivi_measurements` avec `sync_origin=android_native`, `source=bluetooth` et une clé `device_event_id` dérivée de l'événement BLE.

L'ACK n'est émis qu'après insertion confirmée ou vérification serveur de toutes les clés lors d'un conflit 409. Les mesures sont commitées dans la file AES-GCM avant la programmation d'un `OneTimeWorkRequest` WorkManager soumis à la contrainte réseau. Le Worker revalide la session et le consentement, isole les événements par propriétaire, puis persiste et acquitte; en cas d'échec réseau/serveur, WorkManager réessaie avec backoff exponentiel sans retirer la mesure de la file. La synchronisation ne dépend donc plus de la présence de l'écran Compose. Les profils non pris en charge et les trames invalides sont acquittés après classification pour éviter de bloquer les événements suivants.

**Conséquence :** le build Android `43551588777` a réussi pour `:app:testDebugUnitTest`, `:app:assembleDebug` et la publication de l'APK debug interne `naxa-main-app-debug-internal` (37 220 739 octets); les trois variantes privées du compagnon ont aussi réussi. Le job instrumenté API 35 `:app:connectedDebugAndroidTest` a terminé **PASS : 2 tests, 0 échec, 0 erreur, 0 ignoré**. Le rapport XML `TEST-emulator-5554 - 15-_app-.xml` est archivé dans l'artefact `naxa-android-emulator-instrumentation-reports` du run `43551588777`. Le workflow qualité `43551588788` a réussi sur le HEAD `ebff7856b63fa476ae494c6460d1739eb0457ee5` : tests Node (`npm test`), TypeScript, ESLint et build Next.js. Le run qualité `43552106750` a également terminé PASS sur le HEAD `f3962e6b1966d07044c2f2cfc8fd85e3d02ce4d6`, incluant les assertions qui protègent la présence des tests instrumentés et du job émulateur. La migration `20261114031521_suivi_android_bluetooth_activity_metrics` est appliquée en Production sous la version Supabase `20261114032325`; son test SQL retourne `passed=true`, les trois contraintes acceptent `vitesse_cyclisme` et les quatre métriques d'activité se classent dans `activite`. Les advisors de sécurité Production ne signalent aucun finding lié aux objets `suivi_measurements`, `suivi_reminders`, `suivi_alert_rules` ou `suivi_measurement_family`. Un index inutilisé `suivi_measurements_type_date_idx` apparaît en information performance, sans blocage. Aucun téléphone ni périphérique USB n'est attaché à cet environnement; les essais avec capteur BLE réel restent à réaliser. Le parcours Web Bluetooth navigateur reste séparé.
## 3. Corrections déjà intégrées

- Accusé de réception des événements natifs après traitement, sans expiration arbitraire de 12 secondes.
- Événement conservé en cas d'échec temporaire de traitement.
- Débordement BLE durci : les 300 événements déjà acceptés ne sont plus tronqués. Le nouvel événement qui arrive à saturation est refusé et comptabilisé dans une métadonnée AES-GCM séparée (`queue_overflow`), hors de la file des mesures.
- Si une mesure est refusée, le service coupe les connexions BLE actives, annule les tentatives de reconnexion et efface les sessions persistées. La collecte ne repart qu'après action explicite de reconnexion; le Worker est quand même réveillé pour vider les mesures conservées.
- Le statut natif affiche le nombre d'événements refusés et, lorsque disponible, le sous-total de mesures. Les anciens marqueurs ne contenant pas la répartition restent explicitement « détail inconnu ».
- Le consommateur fusionne le marqueur séparé à la lecture et l'acquitte avec son identifiant courant; un marqueur mis à jour entre lecture et acquittement reste donc visible.
- Purge des sessions Bluetooth aux trois parcours de déconnexion.
- Revalidation serveur du compte et correspondance du propriétaire avant reprise d'une session.
- Récepteur Android de redémarrage avec contrôle de session et permission Bluetooth.
- Découverte GATT des caractéristiques Device Information (fabricant, modèle, firmware) et Battery Level.
- Décodeur Kotlin natif : fréquence cardiaque, tension systolique/diastolique, température, oxymétrie, glycémie, poids, composition corporelle, vitesse de course, cadence, longueur de foulée, vitesse de vélo d'intérieur et cadence de pédalier. Les types d'activité sont mappés vers le consentement `activite`; la vitesse de roue CSC n'est pas calculée sans circonférence fiable.
- Enregistrement idempotent des appareils par `platform_device_id` et rafraîchissement des métadonnées de connexion.
- Insertion des mesures avec `sync_origin=android_native`; ACK après persistance et vérification explicite des doublons HTTP 409.
- File BLE native conservée en cas de panne réseau; WorkManager réveille le synchroniseur sur connectivité et reprend les demandes persistées après fermeture de l'écran/processus.
- Le consommateur mesure a été déplacé de Compose vers un Worker unique; l'écran ne fait que suivre la file. Un verrou de synchronisation évite le traitement concurrent par plusieurs Workers.
- Tests JUnit du décodeur, des familles de consentement et de la politique de file exécutés avec succès dans `:app:testDebugUnitTest`; assertions structurelles couvrent Worker, réseau requis, backoff, isolation du compte et ACK après persistance.
- Tests instrumentés API 35 `android/app/src/androidTest/java/cm/naxa/app/NaxaBleRuntimeInstrumentationTest.kt` : **PASS 2/2**. Le test `androidKeystoreQueueRefusesOverflowWithoutEvictingAndResumesAfterAck` valide stockage AES-GCM/Android Keystore, conservation ordonnée des 300 événements, refus des 301e/302e, ACK/libération du slot et reprise; le test `measurementSyncIsPersistedWithNetworkConstraint` valide l'enregistrement du Worker unique avec `NetworkType.CONNECTED`.
- Conflit Kotlin `NaxaBootReceiver` corrigé : la déclaration en double présente à la fin de `NaxaReminderReceiver.kt` a été supprimée; le récepteur de démarrage reste déclaré dans son fichier dédié.

## 4. Protocoles réellement décodés

Le code comporte des décodeurs standards pour :
- Heart Rate (180D/2A37)
- Blood Pressure (1810/2A35)
- Health Thermometer (1809/2A1C)
- Pulse Oximeter spot-check et continuous (1822/2A5E, 2A5F)
- Glucose (1808/2A18)
- Weight Scale (181D/2A9D)
- Body Composition (181B/2A9C)
- Running Speed and Cadence (1814/2A53)
- Fitness Machine Indoor Bike Data (1826/2AD2)
- Cycling Speed and Cadence (1816/2A5B)

Le décodeur Kotlin de l'APK couvre fréquence cardiaque, tension (systolique/diastolique), température, oxymétrie, glycémie, poids, composition corporelle, vitesse de course, cadence, longueur de foulée, vitesse de vélo d'intérieur et cadence de pédalier. La migration `20261114031521_suivi_android_bluetooth_activity_metrics.sql` autorise la vitesse cycliste dans les trois contraintes SQL et la classe dans `activite`. La vitesse de roue CSC n'est pas déduite sans circonférence fiable. La PWA conserve son décodeur JavaScript distinct. Ces profils standards ne certifient pas les 21 catégories commerciales. Les appareils propriétaires, ECG, spiromètres, lecteurs lipidiques, thermomètres infrarouges et autres modèles non exposant ces profils exigent des adaptateurs spécifiques et des essais documentés.

## 5. Risques et travaux non clos

1. **Tests automatisés unitaires, instrumentés et qualité : PASS.** `:app:testDebugUnitTest`, `:app:assembleDebug` et `:app:connectedDebugAndroidTest` ont réussi dans le run Android `43551588777`. Le rapport instrumenté donne 2 tests, 0 échec, 0 erreur, 0 ignoré. Le workflow qualité `43551588788` passe sur `ebff7856...`; le contrôle renforcé `43552106750` passe aussi sur `f3962e6...` : `npm test`, TypeScript, ESLint et build Next.js.
2. **Build APK : PASS.** `:app:assembleDebug` et l'upload `naxa-main-app-debug-internal` ont réussi dans le run `43551588777` (37 220 739 octets). Il s'agit d'un APK debug interne, pas d'une version de production ni d'une certification d'installation terrain.
3. **Validation WorkManager : PASS code + émulateur; matériel réel restant.** Le `OneTimeWorkRequest` réseau est déclenché après écriture durable; contraintes réseau, backoff exponentiel, isolation du compte et ACK après persistance sont couverts par les tests. Le test instrumenté API 35 confirme l'existence du travail unique et sa contrainte `CONNECTED`. La reprise après fermeture forcée, perte/retour du réseau et redémarrage doit encore être validée sur téléphone réel. Aucun job périodique n'est utilisé : le déclenchement est événementiel.
4. **Profils d'activité : PASS code/CI.** Les décodeurs Android produisent `vitesse_course`, `cadence_course`, `longueur_foulee` et `vitesse_cyclisme`; le mapping de consentement `activite`, les tests JUnit et la migration SQL dédiée les couvrent. La vitesse de roue CSC reste non calculée sans circonférence configurée.
5. **Sessions chiffrées :** stockage AES-GCM via Android Keystore et contrôle de propriétaire confirmés au build/statique; le chemin de migration d'anciennes sessions JSON reste toléré et doit être vérifié sur installation ayant des sessions historiques.
6. **Permissions Android : PASS code/CI, terrain restant.** Le manifeste, les permissions runtime SCAN/CONNECT, le contrôle avant démarrage et la garde de reconnexion sont vérifiés. Refus, révocation, Android 11/12+ et restrictions OEM doivent être éprouvés sur appareils réels.
7. **File bornée : VERT code + JUnit + émulateur.** La politique de capacité est couverte par JUnit et le test instrumenté API 35. Celui-ci valide 300 événements conservés, refus des 301e/302e, aucun événement ancien supprimé, puis ACK, libération et acceptation d'un nouvel événement. Le marqueur de saturation reste visible jusqu'à libération d'une place. Les 300 événements acceptés restent synchronisables. La mesure qui arrive après saturation est refusée et comptabilisée, mais son contenu n'est pas conservé. **Homologation sur capteur physique restante.**
8. **Migration SQL Production : VERT.** Migration `20261114031521_suivi_android_bluetooth_activity_metrics` appliquée sur le projet Production `eouwtuusnsuxaejsxknf`, enregistrée sous la version `20261114032325`. Le test `naxa_20261114031521_suivi_android_bluetooth_activity_metrics_pass` retourne `passed=true`; les trois contraintes SQL et les quatre familles d'activité sont vérifiées directement sur Production. Aucun finding sécurité lié aux objets du suivi n'est ressorti des advisors.
9. **Validation matérielle BLE : ORANGE.** Aucun téléphone ni capteur BLE physique n'est connecté à cet environnement (aucun périphérique ADB/USB accessible). L'émulateur valide le stockage chiffré et le cycle de file/Worker, mais ne reproduit pas la radio Bluetooth, les notifications GATT d'un capteur, les variantes OEM, les révocations de permission ni la reprise après redémarrage réel. Ces essais physiques demeurent obligatoires avant homologation commerciale de chaque modèle.

## 6. Décision d'architecture appliquée

- PWA navigateur : Web Bluetooth, décodeur JavaScript et file IndexedDB.
- APK Android : écran Jetpack Compose, service BLE natif, décodeur Kotlin, file AES-GCM et synchronisation WorkManager.
- Le service BLE reste propriétaire des connexions; le Worker n'ouvre aucune liaison Bluetooth et ne fait que consommer les événements persistés.
- Aucun pont WebView n'est supposé ni requis.

## 7. Critère AU VERT

Le chantier ne pourra être déclaré vert qu'après :
- parcours utilisateur complet dans l'APK installé;
- scan, sélection, connexion, notifications GATT, déconnexion et reconnexion;
- contrôle de consentement et isolation de comptes;
- règle logicielle de saturation à 300 sans éviction des mesures déjà acceptées : PASS code/CI;
- migration SQL versionnée appliquée et testée sur le projet Supabase Production : PASS;
- tests de décodage automatisés exécutés;
- scénario physique réel : 300 mesures hors ligne, refus de la 301e, vidage/synchronisation, reprise WorkManager, redémarrage et reconnexion manuelle;
- essais physiques documentés pour chaque modèle annoncé compatible;
- preuve de build APK et rapport de test reproductible.

Aucun déploiement Vercel n'est autorisé par cet audit.

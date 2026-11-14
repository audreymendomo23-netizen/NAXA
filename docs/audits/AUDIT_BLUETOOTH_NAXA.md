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

**Conséquence :** le build Android `43551588777` a réussi pour `:app:testDebugUnitTest`, `:app:assembleDebug` et la publication de l'APK debug interne `naxa-main-app-debug-internal` (37 220 739 octets); les trois variantes privées du compagnon ont aussi réussi. Le workflow qualité `43551588788` a réussi sur le HEAD `ebff7856b63fa476ae494c6460d1739eb0457ee5` : tests Node (`npm test`), TypeScript, ESLint et build Next.js. La migration `20261114031521_suivi_android_bluetooth_activity_metrics` est désormais appliquée en Production sous la version Supabase `20261114032325`; son test SQL retourne `passed=true`, les trois contraintes acceptent `vitesse_cyclisme` et les quatre métriques d'activité se classent dans `activite`. Les advisors de sécurité Production ne signalent aucun finding lié aux objets `suivi_measurements`, `suivi_reminders`, `suivi_alert_rules` ou `suivi_measurement_family`. Un index inutilisé `suivi_measurements_type_date_idx` apparaît en information performance, sans blocage. Le job d'instrumentation Android API 35 `43551588777` est en cours : aucune conclusion n'est encore attribuée aux tests de runtime. Aucun téléphone ni périphérique USB n'est attaché à cet environnement; les essais avec capteur BLE réel restent à réaliser. Le parcours Web Bluetooth navigateur reste séparé.
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
- Tests instrumentés ajoutés dans `android/app/src/androidTest/java/cm/naxa/app/NaxaBleRuntimeInstrumentationTest.kt` : Android Keystore réel de l'émulateur, saturation 300/301, absence d'éviction, ACK/libération/reprise et programmation WorkManager avec contrainte réseau. Job API 35 en cours dans GitHub Actions `43551588777`.
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

1. **Tests automatisés unitaires et qualité : PASS.** `:app:testDebugUnitTest` et `:app:assembleDebug` ont réussi dans le run `43551588777`. Le workflow qualité `43551588788` a réussi sur le HEAD `ebff7856b63fa476ae494c6460d1739eb0457ee5` : `npm test` (scripts `node --test scripts/test-*.cjs`), TypeScript, ESLint et build Next.js passent. Les tests instrumentés API 35 restent en cours dans le même run Android.
2. **Build APK : PASS.** `:app:assembleDebug` et l'upload `naxa-main-app-debug-internal` ont réussi dans le run `43551588777` (37 220 739 octets). Il s'agit d'un APK debug interne, pas d'une version de production ni d'une certification d'installation terrain.
3. **Validation WorkManager : PASS code/CI unitaire; runtime émulateur en cours, matériel restant.** Le `OneTimeWorkRequest` réseau est déclenché après écriture durable; contraintes réseau, backoff exponentiel, isolation du compte et ACK après persistance sont couverts par assertions et build Android. Le test instrumenté API 35 vérifie la programmation persistée et la contrainte réseau; run `43551588777` encore en cours. La reprise réelle après fermeture forcée, reconnexion réseau, changement de compte et redémarrage sur téléphone reste nécessaire. Aucun job périodique n'est utilisé : le déclenchement est événementiel.
4. **Profils d'activité : PASS code/CI.** Les décodeurs Android produisent `vitesse_course`, `cadence_course`, `longueur_foulee` et `vitesse_cyclisme`; le mapping de consentement `activite`, les tests JUnit et la migration SQL dédiée les couvrent. La vitesse de roue CSC reste non calculée sans circonférence configurée.
5. **Sessions chiffrées :** stockage AES-GCM via Android Keystore et contrôle de propriétaire confirmés au build/statique; le chemin de migration d'anciennes sessions JSON reste toléré et doit être vérifié sur installation ayant des sessions historiques.
6. **Permissions Android : PASS code/CI, terrain restant.** Le manifeste, les permissions runtime SCAN/CONNECT, le contrôle avant démarrage et la garde de reconnexion sont vérifiés. Refus, révocation, Android 11/12+ et restrictions OEM doivent être éprouvés sur appareils réels.
7. **File bornée : VERT code + tests JUnit; test instrumenté en cours.** La politique de capacité est extraite dans `NaxaBleQueuePolicy` et couverte par JUnit (capacité 299/300, comptage des événements/mesures et marqueurs historiques). À 300, aucun événement déjà accepté n'est éjecté; le nouvel événement est refusé, comptabilisé hors file, et la collecte/reconnexion est arrêtée. Le marqueur de saturation n'est acquitté qu'après libération d'une place; l'UI et le service interdisent scan/connexion tant que 300 événements restent présents. Le test instrumenté API 35 exerce l'Android Keystore, les 300/301 événements, l'ACK, la reprise et WorkManager; résultat du job `43551588777` encore en attente. Les scénarios avec périphérique BLE physique restent à exécuter.
8. **Migration SQL Production : VERT.** Migration `20261114031521_suivi_android_bluetooth_activity_metrics` appliquée sur le projet Production `eouwtuusnsuxaejsxknf`, enregistrée sous la version `20261114032325`. Le test `naxa_20261114031521_suivi_android_bluetooth_activity_metrics_pass` retourne `passed=true`; les trois contraintes SQL et les quatre familles d'activité sont vérifiées directement sur Production. Aucun finding sécurité lié aux objets du suivi n'est ressorti des advisors.
9. **Validation matérielle BLE : ORANGE.** Aucun téléphone ni capteur BLE physique n'est connecté à cet environnement (aucun périphérique ADB/USB accessible). Le job émulateur valide la file Android et WorkManager, mais ne peut certifier découverte radio, notifications GATT, particularités OEM, permissions/révocations et reprise réelle après redémarrage. Ces essais physiques demeurent obligatoires avant homologation des modèles.

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

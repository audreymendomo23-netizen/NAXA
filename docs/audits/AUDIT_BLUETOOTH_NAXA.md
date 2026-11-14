# Audit global — Bluetooth NAXA

Date de travail : 14 novembre 2026
Branche : `main`
Statut : **VERT logiciel + CI + Replay SQL; ORANGE global tant que migration Production et validation BLE sur appareils réels ne sont pas terminées**

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

**Conséquence :** le build Android `43550421100` a réussi sur le SHA `083abb3dedfc4e3f70f6ac2365cb13b6b67e9895`, y compris `:app:testDebugUnitTest`, `:app:assembleDebug` et publication de `naxa-main-app-debug-internal` (37 220 739 octets); les variantes privées du compagnon ont également réussi. Aucun fichier Kotlin Android n'a changé après ce SHA jusqu'au HEAD `a8483dde777f7cbcd2f893672a04005058e87286`. Le workflow qualité `43550819807` a réussi sur ce HEAD : tests Node (`npm test`), TypeScript, ESLint et build Next.js. La migration `20261114031521_suivi_android_bluetooth_activity_metrics` a été appliquée au projet Replay actif `pwfftcsjyeibxxqhwysw` et son test SQL retourne `passed=true`. Le projet Supabase Production nommé `Naxa` (`eouwtuusnsuxaejsxknf`) conserve encore les anciennes contraintes; il n'a pas été modifié dans cet audit. Les essais BLE/WorkManager sur téléphone restent nécessaires. Le parcours Web Bluetooth navigateur reste séparé.

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
- Tests JUnit du décodeur et des familles de consentement exécutés avec succès dans `:app:testDebugUnitTest`; assertions structurelles versionnées couvrent le Worker, le réseau requis, le backoff, l'isolation du compte et l'ACK après persistance.
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

1. **Tests automatisés : PASS.** `:app:testDebugUnitTest` a réussi dans le run Android `43550421100`, incluant les tests du décodeur, familles de consentement et politique de file. Le workflow qualité `43550819807` a réussi sur le HEAD `a8483dde777f7cbcd2f893672a04005058e87286` : `npm test` (scripts `node --test scripts/test-*.cjs`), TypeScript, ESLint et build Next.js passent.
2. **Build APK : PASS.** `:app:assembleDebug` et l'upload `naxa-main-app-debug-internal` ont réussi dans le run `43550421100` (37 220 739 octets). Il s'agit d'un APK debug interne, pas d'une version de production ni d'une certification d'installation terrain.
3. **Validation WorkManager : PASS code/CI, terrain restant.** Le `OneTimeWorkRequest` réseau est déclenché après écriture durable; contraintes réseau, backoff exponentiel, isolation du compte et ACK après persistance sont couverts par assertions et build Android. La reprise réelle après fermeture forcée, reconnexion réseau, changement de compte et redémarrage Android doit encore être exécutée sur téléphone. Aucun job périodique n'est utilisé : le déclenchement est événementiel.
4. **Profils d'activité : PASS code/CI.** Les décodeurs Android produisent `vitesse_course`, `cadence_course`, `longueur_foulee` et `vitesse_cyclisme`; le mapping de consentement `activite`, les tests JUnit et la migration SQL dédiée les couvrent. La vitesse de roue CSC reste non calculée sans circonférence configurée.
5. **Sessions chiffrées :** stockage AES-GCM via Android Keystore et contrôle de propriétaire confirmés au build/statique; le chemin de migration d'anciennes sessions JSON reste toléré et doit être vérifié sur installation ayant des sessions historiques.
6. **Permissions Android : PASS code/CI, terrain restant.** Le manifeste, les permissions runtime SCAN/CONNECT, le contrôle avant démarrage et la garde de reconnexion sont vérifiés. Refus, révocation, Android 11/12+ et restrictions OEM doivent être éprouvés sur appareils réels.
7. **File bornée : VERT code + CI.** La politique de capacité est extraite dans `NaxaBleQueuePolicy` et couverte par JUnit (capacité 299/300, comptage distinct des événements/mesures et marqueurs historiques). À 300, aucun événement déjà accepté n'est éjecté; le nouvel événement est refusé, comptabilisé hors file, et la collecte/reconnexion est arrêtée. Le marqueur de saturation n'est acquitté qu'après libération d'une place; l'UI et le service interdisent scan/connexion tant que 300 événements restent présents. Une mesure arrivant après saturation est comptabilisée mais son contenu n'est pas récupéré par NAXA. **Statut logiciel : VERT.** Le test physique 300/301 événements, reprise WorkManager et reconnexion manuelle reste à exécuter sur téléphone.
8. **Migration SQL Replay : PASS.** Migration `20261114031521_suivi_android_bluetooth_activity_metrics` appliquée sur le projet `pwfftcsjyeibxxqhwysw`; le test `naxa_20261114031521_suivi_android_bluetooth_activity_metrics_pass` retourne `passed=true`. Aucun finding de sécurité Supabase n'a été relevé pour les objets `suivi_measurements`, `suivi_reminders`, `suivi_alert_rules` ou `suivi_measurement_family` dans les advisors Replay. La base Production `eouwtuusnsuxaejsxknf` garde les anciennes contraintes et nécessite la livraison de cette migration selon la fenêtre de déploiement autorisée.
9. **Validation clinique et matérielle : EN ATTENTE.** Consentement, isolation de comptes et absence de diagnostic automatique restent contrôlés par le code; essais réels sur modèles physiques, permissions Android, fermeture forcée, réseau, redémarrage et reprise après saturation non exécutés sur téléphone.

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
- règle logicielle de saturation à 300 sans éviction des mesures déjà acceptées : PASS code/CI; scénario réel sur appareil (300 mesures hors ligne, refus de la 301e, vidage et reprise manuelle) à confirmer;
- tests de décodage automatisés exécutés;
- essais physiques documentés pour chaque modèle annoncé compatible;
- preuve de build APK et rapport de test reproductible.

Aucun déploiement Vercel n'est autorisé par cet audit.

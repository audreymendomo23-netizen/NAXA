# Audit global — Bluetooth NAXA

Date de travail : 14 novembre 2026
Branche : `main`
Statut : **ORANGE pour l'audit Bluetooth global — sous-point « file bornée à 300 » VERT logiciel/CI; build Android et qualité NAXA PASS; validation matérielle sur téléphone encore non exécutée**

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

**Conséquence :** le build Android `43549423189` a réussi sur `cb23e0b5ee5c639014746db480e9016023bd5eed`, y compris compilation, tests unitaires, assemblage APK et publication de l'artefact `naxa-main-app-debug-internal` (37 220 252 octets). Les deux jobs Android ont réussi, y compris les variantes privées du compagnon. Le HEAD `aa6b6d61a31e9d3e767560fb8141d82e03596f55` ne modifie ensuite que le test structurel : le code Kotlin compilé est identique. Le workflow qualité `43549435331` a réussi sur ce HEAD : `npm test` (dont `test-suivi-interoperabilite.cjs`), TypeScript, ESLint et build Next.js. Les essais BLE/WorkManager sur téléphone restent nécessaires. Le parcours Web Bluetooth navigateur reste séparé.

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
- Décodeur Kotlin natif ajouté pour fréquence cardiaque, tension systolique/diastolique, température, oxymétrie, glycémie, poids et composition corporelle; les profils d'activité sont validés mais leurs champs vitesse/cadence ne sont pas stockés tant que le schéma n'offre pas les types correspondants.
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

Le décodeur Kotlin de l'APK couvre actuellement fréquence cardiaque, tension (systolique/diastolique), température, oxymétrie, glycémie, poids et composition corporelle. Les profils course, vélo d'intérieur et cadence cycliste sont reconnus/validés, mais les champs vitesse et cadence ne sont pas enregistrés : le schéma actuel ne fournit pas de types persistables compatibles pour ces valeurs. La PWA conserve son décodeur JavaScript distinct. Ces profils standards ne certifient pas les 21 catégories commerciales. Les appareils propriétaires, ECG, spiromètres, lecteurs lipidiques, thermomètres infrarouges et autres modèles non exposant ces profils exigent des adaptateurs spécifiques et des essais documentés.

## 5. Risques et travaux non clos

1. **Tests automatisés : PASS.** `:app:testDebugUnitTest` a réussi dans le run Android `43549423189`. Le workflow qualité `43549435331` a aussi réussi sur le HEAD `aa6b6d61a31e9d3e767560fb8141d82e03596f55` : `npm test` exécute les scripts `node --test scripts/test-*.cjs`, dont les assertions de saturation BLE, puis TypeScript et ESLint passent.
2. **Build APK : PASS.** `:app:assembleDebug` et l'upload `naxa-main-app-debug-internal` ont réussi dans le run `43549423189` (37 220 252 octets). Il s'agit d'un APK debug interne, pas d'une version de production ni d'une certification d'installation terrain.
3. **Validation WorkManager : PARTIELLE.** Le `OneTimeWorkRequest` réseau est compilé dans le build et son déclenchement suit l'écriture durable des mesures. La reprise réelle après fermeture forcée, reconnexion réseau, changement de compte et redémarrage Android reste à vérifier sur téléphone. Aucun job périodique n'est utilisé : le déclenchement est événementiel.
4. **Profils d'activité :** vitesse/cadence reconnues mais non persistées car le contrat SQL ne possède pas de types compatibles. Ne pas les convertir en pas ou minutes.
5. **Sessions chiffrées :** le lecteur accepte encore les anciennes sessions JSON en clair pour migration au prochain enregistrement; confirmer la migration sur appareil.
6. **Permissions Android :** tester SCAN et CONNECT, versions Android, refus, révocation et restrictions de démarrage en arrière-plan.
7. **File bornée : VERT logiciel/CI.** La limite 300, le refus du nouvel événement sans éviction de ceux déjà acceptés, le marqueur AES-GCM séparé, le compteur des mesures refusées, la suspension BLE et l'acquittement sûr sont couverts par les assertions structurelles `npm test`. Le build Android, les tests JUnit et le workflow qualité complet sont PASS. Les mesures déjà acceptées restent synchronisables. Une mesure qui arrive après saturation est refusée et comptabilisée, mais son contenu n'est pas récupéré par NAXA; aucune mémoire interne de l'appareil n'est présumée. **Validation terrain restante :** reproduire sur téléphone 300 mesures hors ligne, vérifier le refus de la 301e, l'arrêt des notifications/reconnexions, redémarrer, synchroniser les 300 conservées, acquitter le marqueur puis reconnecter manuellement.
8. **Validation clinique et matérielle :** consentement, isolation de comptes, absence de diagnostic automatique, essais sur modèles physiques et preuve d'APK restent à faire.

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

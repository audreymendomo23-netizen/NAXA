# Audit global — Bluetooth NAXA

Date de travail : 14 novembre 2026
Branche : `main`
Statut : **ORANGE — architecture native non raccordée, tests et essais matériels non exécutés**

## 1. Périmètre contrôlé

- Interface web de suivi : `src/components/suivi/SuiviConnecte.tsx`
- Décodeurs GATT : `src/lib/suivi/ble-protocols.js`
- Service Android : `android/app/src/main/java/cm/naxa/app/NaxaBleForegroundService.kt`
- Activité Android : `android/app/src/main/java/cm/naxa/app/MainActivity.kt`
- Récepteur de redémarrage : `android/app/src/main/java/cm/naxa/app/NaxaBootReceiver.kt`
- Test d'interopérabilité : `scripts/test-suivi-interoperabilite.cjs`
- Contrat de compatibilité : `docs/suivi-compatibilite-dispositifs.md`

## 2. Constat architectural bloquant

Le parcours web de suivi utilise l'API Web Bluetooth et attend un objet JavaScript `window.NaxaAndroid` pour déléguer certaines opérations au natif.

L'APK Android actuellement livré utilise une interface Jetpack Compose dans `MainActivity.kt`. Cette activité ne crée pas de WebView et n'expose aucune interface JavaScript (`addJavascriptInterface`). Les seuls appels de `MainActivity` au service BLE sont les trois appels `stopForLogout`; elle ne déclenche ni `ACTION_CONNECT`, ni découverte BLE, ni lecture de la file d'événements.

Le service Android possède bien des actions de connexion/déconnexion et une file d'événements, mais aucun raccordement complet entre le parcours de suivi web et l'APK Compose n'est démontré par le code inspecté.

**Conséquence :** la collecte Web Bluetooth en premier plan dans un navigateur compatible et la collecte BLE Android en arrière-plan ne constituent pas encore un parcours intégré et prouvé dans l'APK NAXA. Ne pas annoncer la continuité BLE native en arrière-plan comme disponible tant que ce raccordement n'est pas implémenté et testé.

## 3. Corrections déjà intégrées

- Accusé de réception des événements natifs après traitement, sans expiration arbitraire de 12 secondes.
- Événement conservé en cas d'échec temporaire de traitement.
- Signalement explicite du débordement de la file native bornée.
- Purge des sessions Bluetooth aux trois parcours de déconnexion.
- Revalidation serveur du compte et correspondance du propriétaire avant reprise d'une session.
- Récepteur Android de redémarrage avec contrôle de session et permission Bluetooth.
- Découverte GATT des caractéristiques Device Information (fabricant, modèle, firmware) et Battery Level.
- Ajout de fixtures de décodage pour fréquence cardiaque, tension, température, oxymétrie, poids, composition corporelle, course, vélo d'intérieur et cadence cycliste.

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

Ces profils standards ne certifient pas les 21 catégories commerciales. Les appareils propriétaires, ECG, spiromètres, lecteurs lipidiques, thermomètres infrarouges et autres modèles non exposant ces profils exigent des adaptateurs spécifiques et des essais documentés.

## 5. Risques et travaux non clos

1. **Raccordement APK ↔ service BLE ↔ suivi utilisateur :** bloquant.
2. **Découverte BLE native :** le service inspecté ne démontre pas de parcours de scan et de sélection utilisable depuis l'APK.
3. **Persistance des sessions :** les événements et les métadonnées de session (adresse, clé logique, propriétaire) sont désormais chiffrés avec AES-GCM et Android Keystore. Le lecteur accepte encore les anciennes sessions JSON en clair pour migration au prochain enregistrement; vérifier ce chemin sur appareil et confirmer la migration.
4. **Permissions Android :** vérifier séparément SCAN et CONNECT, les versions Android, le refus, la révocation et les restrictions de démarrage en arrière-plan.
5. **File bornée :** le marqueur de débordement signale une perte, mais ne restaure pas les événements supprimés; vérifier également la persistance atomique et les scénarios de crash.
6. **Mesures :** ajouter des tests de limites, champs optionnels, valeurs SFLOAT spéciales, timestamps, unités et trames tronquées pour chaque décodeur.
7. **Sécurité clinique :** la validation humaine, le consentement familial, l'appartenance du compte et l'absence de diagnostic automatique doivent être vérifiés de bout en bout.
8. **Validation d'exécution :** compilation Gradle, tests Node, tests Android et essais sur appareils physiques non exécutés dans ce lot.

## 6. Décision d'architecture recommandée

Avant d'étendre la liste de matériels, choisir et implémenter un seul chemin natif cohérent :
- soit un écran de suivi Android natif Compose, relié au service BLE et au stockage/synchronisation NAXA;
- soit un conteneur WebView sécurisé avec pont JavaScript strictement limité, authentification et cycle de vie BLE explicitement raccordés.

Ne pas maintenir deux chemins natifs concurrents sans contrat d'événements, d'authentification et de consentement commun.

## 7. Critère AU VERT

Le chantier ne pourra être déclaré vert qu'après :
- parcours utilisateur complet dans l'APK installé;
- scan, sélection, connexion, notifications GATT, déconnexion et reconnexion;
- contrôle de consentement et isolation de comptes;
- stockage hors ligne, synchronisation sans doublon et reprise après redémarrage;
- tests de décodage automatisés exécutés;
- essais physiques documentés pour chaque modèle annoncé compatible;
- preuve de build APK et rapport de test reproductible.

Aucun déploiement Vercel n'est autorisé par cet audit.

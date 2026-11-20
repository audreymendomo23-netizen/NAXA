# NAXA Android — application native

Application Android native Kotlin / Jetpack Compose. Aucun WebView, Capacitor ou React Native.

## Configuration locale

Prérequis : Android Studio récent, JDK 17, Android SDK 35 et Gradle 8.9 (compatible avec Android Gradle Plugin 8.7.3), Kotlin 2.2.21 et Google Services Gradle plugin 4.5.0.

Dans `~/.gradle/gradle.properties` (ne pas committer ce fichier), définir :

```properties
NAXA_BASE_URL=https://<hôte-api-naxa-validé>
SUPABASE_URL=https://<projet>.supabase.co
SUPABASE_ANON_KEY=<clé publique anon ou publishable>
```

L'hôte NAXA par défaut est `https://nnaxa.vercel.app` (domaine canonique de l'application). Il peut être remplacé par `NAXA_BASE_URL` lors d'une compilation de recette distincte.

L'hôte API peut également être fourni par variable d'environnement `NAXA_BASE_URL`. Les valeurs Firebase facultatives utilisées par les notifications sont `FIREBASE_API_KEY`, `FIREBASE_APP_ID`, `FIREBASE_PROJECT_ID` et `FIREBASE_SENDER_ID`. Elles peuvent être passées par propriétés Gradle ou variables d'environnement. Aucune clé service-role/secret Supabase ne doit être intégrée à l'APK.

Ouvrir le dossier `android/` dans Android Studio, synchroniser Gradle, puis lancer la configuration `app`. La CI du dépôt installe Gradle 8.9 et Android API 35 automatiquement :

```bash
gradle :app:testDebugUnitTest
gradle :app:assembleDebug
```

## Fonctionnalités natives intégrées

- Interface Jetpack Compose : déclaration de majorité visiteur, connexion, navigation et espace Client public/compte.
- Connexion e-mail/mot de passe Supabase Auth REST, vérification Bearer sur `GET /api/v1/auth/session`, renouvellement et déconnexion.
- Contrôle serveur `ageVerified` obligatoire pour les comptes connectés ; la déclaration visiteur locale ne remplace pas ce contrôle.
- Jetons Supabase chiffrés AES-GCM avec une clé non exportable Android Keystore.
- Recherche catalogue médicaments via `GET /api/medicaments/recherche?q=...`, sans prix ni stock fictif.
- Scanner natif : prise de photo via l'appareil photo Android, sélection d'image/PDF et OCR ML Kit embarqué sur l'appareil ; PDF limités à 10 pages et 40 Mo.
- Recherche de pharmacies proches via permission GPS explicite et `GET /api/pharmacies/proches?lat=...&lng=...`.
- Historique Client natif connecté à `reservations`, `client_achats` et `reservation_events` via PostgREST avec le Bearer de session, la clé publique et les politiques RLS Supabase. La vue `client_achats` utilise `security_invoker=true` et le filtre SQL `auth.uid()` ; aucun filtre `client_id` n'est envoyé car cette colonne n'est pas exposée par la vue. Les détails d'achat sont signalés indisponibles si la vue ne peut pas être lue.
- Notifications natives FCM : permission Android demandée dans le profil, enregistrement Bearer, synchronisation lors de rotation du jeton et révocation à la déconnexion.
- Les bases natives existantes de BLE, rappels et notifications sont conservées, mais leur raccordement complet aux écrans Compose reste à faire.

Tests JVM présents : `CatalogueRepositoryTest` et `PharmacyRepositoryTest` valident les données catalogue/pharmacie et l'absence de prix, stocks ou distances inventés. La CI Android exécute les tests puis `assembleDebug` et conserve un APK debug temporaire comme artefact interne, jamais comme APK de production.

## Limites explicites

Cette tranche couvre le contrôle de majorité, l'authentification, le catalogue, la recherche de pharmacies et le scanner local image/PDF. Elle ne couvre pas encore l'ensemble des parcours client, pharmacie, Promoteur, Admin, Responsable, comptable, pharmacien, gestionnaire de stock ou livreur. Le panier, les commandes, la livraison, les fonctions ERP, le mode offline métier et la synchronisation complète restent à implémenter et à tester contre les API autorisées.

Aucun APK signé de production n'est généré ici. Le build Gradle, les tests instrumentés, la recette sur appareils Android et la signature de release doivent être exécutés avant toute diffusion. La distribution prévue reste l'APK signé depuis le site officiel NAXA, sans publication Play Store.


## Assistance audio et partage d’écran natifs — état

Le parcours Support natif Kotlin/Compose est intégré aux espaces Client et Professionnel. Il utilise les API v1 authentifiées par Bearer, la signalisation Supabase Realtime privée et le transport WebRTC natif. L’appel audio requiert la permission microphone Android. Le partage d’écran est facultatif : consentement NAXA explicite, confirmation système MediaProjection pour chaque session, service foreground déclaré `mediaProjection|microphone`, arrêt explicite ou au raccrochage et audit serveur des événements.

Le parcours ne fournit aucun canal de contrôle distant, ne capture pas l’audio système et n’enregistre pas les flux. Une révocation de session/identité ferme le média. La configuration HTTP `10.0.2.2` est permise uniquement dans le manifeste du variant Android `debug` pour les tests sur émulateur ; le manifeste commun et les builds de production conservent `usesCleartextTraffic=false`.

### Recette automatisée GitHub Actions

Le workflow `.github/workflows/naxa-support-native-android-e2e.yml` orchestre sur Replay un Client Android API 35 et un Agent Support Chromium : création d’un ticket authentifié, attribution à l’Agent, demande/acceptation d’appel, connexion audio WebRTC, confirmation MediaProjection, réception vidéo par l’Agent, arrêt du partage, raccrochage et vérification des heartbeats/audits. Les fixtures sont supprimées à la fin du job. Les jetons de session sont éphémères, masqués dans les logs et ne sont pas intégrés à l’APK.

Cette recette d’émulateur complète les tests navigateurs existants mais ne remplace pas la validation finale sur appareils Android physiques (microphones, audio, couches constructeurs et interruptions système). Aucun APK de production n’est signé ou diffusé par cette recette ; la distribution prévue reste l’APK du site officiel NAXA, sans Play Store.

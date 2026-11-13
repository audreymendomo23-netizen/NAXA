# NAXA Android — application native

Application Android native Kotlin / Jetpack Compose. Aucun WebView, Capacitor ou React Native.

## Configuration locale

Prérequis : Android Studio récent, JDK 17, Android SDK 35 et Gradle 8.9 (compatible avec Android Gradle Plugin 8.7.3), Kotlin 2.2.21 et Google Services Gradle plugin 4.5.0.

Dans `~/.gradle/gradle.properties` (ne pas committer ce fichier), définir :

```properties
SUPABASE_URL=https://<projet>.supabase.co
SUPABASE_ANON_KEY=<clé publique anon ou publishable>
```

Les valeurs Firebase facultatives utilisées par les notifications sont `FIREBASE_API_KEY`, `FIREBASE_APP_ID`, `FIREBASE_PROJECT_ID` et `FIREBASE_SENDER_ID`. Elles peuvent être passées par propriétés Gradle ou variables d'environnement. Aucune clé service-role/secret Supabase ne doit être intégrée à l'APK.

Ouvrir le dossier `android/` dans Android Studio, synchroniser Gradle, puis lancer la configuration `app`. La CI du dépôt installe Gradle 8.9 et Android API 35 automatiquement :

```bash
gradle :app:testDebugUnitTest
gradle :app:assembleDebug
```

## Première tranche livrée dans le dépôt

- Interface native Compose : connexion et espace d'accueil avec navigation basse.
- Connexion e-mail/mot de passe via Supabase Auth REST.
- Validation de session par `GET /api/v1/auth/session` avec Bearer token.
- Renouvellement du jeton via refresh token.
- Jetons conservés chiffrés AES-GCM avec clé non exportable Android Keystore.
- Recherche réelle du catalogue médicaments par `GET /api/medicaments/recherche?q=...`.
- Affichage strict des statuts stock : disponible, indisponible ou non vérifié ; aucun prix inventé.
- Tests unitaires de parsing du catalogue et de non-invention de stock/prix.
- Déconnexion distante et effacement local.
- Notifications Firebase et services natifs existants conservés pour intégration ultérieure.

## Limites explicites

Cette tranche est un socle natif de connexion et de navigation, pas encore l'ensemble des parcours client, pharmacie, Promoteur, Admin, Responsable, comptable, pharmacien, gestionnaire de stock ou livreur. Les écrans Catalogue, scanner caméra, panier, commandes, livraison, ERP, offline et synchronisation métier restent à implémenter et à tester contre les API autorisées.

Aucun APK signé de production n'est généré ici. Le build Gradle, les tests instrumentés, la recette sur appareils Android et la signature de release doivent être exécutés avant toute diffusion. La distribution prévue reste l'APK signé depuis le site officiel NAXA, sans publication Play Store.

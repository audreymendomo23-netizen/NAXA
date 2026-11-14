# Audit global de l’application Android NAXA

Date : 14 novembre 2026 (Africa/Douala)  
Branche : `main`  
Commit audité : `f8ad7a5c4eeef2dd41590cbe9f184bb63c0f2167`  
Périmètre : application Android principale, compagnon Android de vérification des paiements, CI, configuration, notifications, BLE et distribution.

## 1. Décision

**STATUT GLOBAL : ROUGE — application Android non complète et non prête pour une diffusion publique.**

Ce statut ne signifie pas que tout le code Android échoue. Le socle natif, plusieurs fonctions Client, le tableau de bord Admin limité, les tests unitaires et une partie des tests BLE sont bien présents. En revanche :

- la majorité des espaces et parcours NAXA ne sont pas portés dans l’application native ;
- l’APK Debug publié par la CI ne reçoit pas les deux paramètres Supabase obligatoires et ne peut donc pas authentifier un utilisateur ;
- aucun build Release signé ni processus de publication de l’APK sur le site NAXA n’est démontré ;
- le push FCM en conditions réelles et l’homologation BLE sur téléphones/capteurs restent non prouvés.

Le statut BLE reste **ORANGE pour essais matériels**. Les validations de code/CI documentées restent valides pour leur périmètre limité.

## 2. Référence et preuves contrôlées

| Élément | Preuve observée | Conclusion |
|---|---|---|
| HEAD | `f8ad7a5c4eeef2dd41590cbe9f184bb63c0f2167` sur `main` | Référence de cet audit |
| Qualité applicative | GitHub Actions run `43552484951`, commit `f8ad7a5...`, conclusion `success` | PASS sur le workflow qualité du dépôt |
| Build Android | Run `43551588777`, commit `ebff7856...`, conclusion `success` | PASS compilation/tests Debug |
| Continuité du code Android | Comparaison `ebff7856...` → `f8ad7a5...` : deux commits ultérieurs, changements limités à deux documents et au script de test d’interopérabilité ; aucun fichier Android modifié | Le résultat de build Android porte sur le code Android toujours présent au HEAD audité |
| Instrumentation Android | Job API 35 du run `43551588777` : `connectedDebugAndroidTest`, 2 tests, 0 échec, 0 erreur, 0 ignoré | PASS pour file chiffrée et WorkManager uniquement |
| Artefact principal | `naxa-main-app-debug-internal`, produit par le run `43551588777`, conservation 7 jours | APK Debug interne, pas un package Release |
| Compagnon paiement | Même run : builds/tests des variantes `standardDebug`, `professionalDebug`, `adminDebug`, contrôle des composants et permissions des manifestes | PASS pour compilation Debug et contrôle statique des variantes |
| Releases GitHub | Aucune release retournée par l’API du dépôt au moment de l’audit | Aucune preuve de livraison publique via Releases |
| APK suivi dans Git | Aucun fichier `.apk` dans l’arbre Git audité | Aucun binaire durable suivi dans le dépôt |

Liens de référence :
- Workflow Android : https://github.com/audreymendomo23-netizen/NAXA/blob/main/.github/workflows/android-native-build.yml
- Configuration Gradle : https://github.com/audreymendomo23-netizen/NAXA/blob/main/android/app/build.gradle.kts
- README Android : https://github.com/audreymendomo23-netizen/NAXA/blob/main/android/README.md
- Routage des rôles : https://github.com/audreymendomo23-netizen/NAXA/blob/main/android/app/src/main/java/cm/naxa/app/NativeRoleRouting.kt
- Accueil et navigation : https://github.com/audreymendomo23-netizen/NAXA/blob/main/android/app/src/main/java/cm/naxa/app/MainActivity.kt
- Audit Bluetooth détaillé : https://github.com/audreymendomo23-netizen/NAXA/blob/main/docs/audits/AUDIT_BLUETOOTH_NAXA.md
- Contrat de compatibilité des dispositifs : https://github.com/audreymendomo23-netizen/NAXA/blob/main/docs/suivi-compatibilite-dispositifs.md

## 3. Audit fonctionnel — application principale

### 3.1 Fonctions constatées dans le code

Sont effectivement présentes dans le périmètre inspecté :

- déclaration locale de majorité avant l’accès visiteur ;
- authentification Supabase, vérification serveur de la session et contrôle serveur `ageVerified` ;
- stockage des jetons avec AES-GCM et Android Keystore ;
- recherche du catalogue de médicaments, sans inventer les prix ni les stocks ;
- recherche de pharmacies proches avec permission de localisation ;
- scanner natif image/PDF avec OCR local ;
- consultation d’un historique Client ;
- écran de notifications, inscription/désinscription FCM côté application ;
- écran natif de suivi Bluetooth et service BLE de fond.

### 3.2 Parcours Client incomplets

La navigation native actuelle expose les onglets `Accueil`, `Rechercher`, `Scanner`, `Achats`, `Profil`. Elle ne reprend pas la navigation Client validée avec un onglet Favoris. Le volet `Achats` connecté affiche l’historique ; il ne constitue pas un parcours complet de panier, de commande, de paiement ou de livraison.

La carte « Dispositifs médicaux » visible sur l’accueil est un composant de présentation et non un catalogue opérationnel accessible depuis cette carte.

Le README Android confirme explicitement que le panier, les commandes, la livraison, les fonctions ERP, le mode offline métier et la synchronisation complète restent à implémenter et tester.

**Conclusion :** le parcours Client natif est une première tranche fonctionnelle, pas une version Android équivalente à l’application NAXA complète.

### 3.3 Rôles professionnels et Admin

Le routage natif est volontairement fermé :

- `supportsClientWorkspace` n’accepte que `client/client` ;
- `supportsAdminWorkspace` n’accepte que `admin/admin` ;
- les autres rôles passent par `UnsupportedNativeRoleScreen`, qui indique que leur espace professionnel n’est pas disponible.

Les tests `NaxaNativeRoleTest` valident ce refus de basculer à tort vers l’espace Client. C’est une bonne protection de cloisonnement, mais cela confirme également que Promoteur, Pharmacie, Partenaire, Responsable, Comptable, Pharmacien, Gestionnaire de stock, Livreur et les autres rôles ne disposent pas encore de leurs espaces natifs.

Le poste Admin est limité à un écran de tableau de bord : indicateurs réseau, actualisation des stocks, alertes et dernières actions. Le code inspecté ne fournit pas les fonctions opérationnelles de l’Admin 360 (gestion, validations, administration des comptes, opérations, sécurité et autres actions métier).

**Conclusion :** le routage est sécurisé en mode fail-closed, mais la couverture fonctionnelle professionnelle et Admin est insuffisante.

## 4. Défaut bloquant de configuration de l’APK CI

### Constat

Dans `android/app/build.gradle.kts`, les paramètres suivants sont lus depuis les propriétés Gradle ou les variables d’environnement, avec une valeur vide par défaut :

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Le workflow `.github/workflows/android-native-build.yml` lance `gradle :app:testDebugUnitTest :app:assembleDebug` sans injecter ces deux paramètres : aucune section `env:`, aucun argument `-P` et aucune étape de configuration ne les transmet.

Dans `AuthRepository.signIn()`, `requireConfigured()` est appelée avant la requête d’authentification et lève l’erreur « Configuration Android manquante : SUPABASE_URL et SUPABASE_ANON_KEY. » lorsque ces valeurs sont vides. Le retour de session ne restaure pas non plus une session quand elles sont absentes.

### Cause racine

Le pipeline vérifie la compilation Kotlin/Gradle et la création du binaire, mais ne vérifie pas que l’APK embarque les paramètres d’exécution nécessaires à l’authentification. Le build peut être PASS alors que l’application livrée ne peut pas connecter un compte.

### Correction exigée

1. Injecter explicitement `SUPABASE_URL` et `SUPABASE_ANON_KEY` depuis les variables/secrets GitHub prévus, sans les écrire en dur dans le dépôt.
2. Ajouter un contrôle préalable qui fait échouer le job si l’une des deux valeurs est absente.
3. Ajouter un contrôle de configuration sur les valeurs compilées et un test de démarrage/connexion sur l’APK construit.
4. Recompiler et tester l’artefact après correction ; ne pas réutiliser l’APK Debug existant comme preuve de livraison.

**Sévérité : BLOQUANT.** L’artefact Debug produit par le workflow actuel n’est pas une preuve d’APK authentifiable.

## 5. Signature, version et distribution

Le fichier Gradle de l’application principale indique :

- `applicationId = cm.naxa.app` ;
- `minSdk = 26`, `targetSdk = 35` ;
- `versionCode = 1`, `versionName = 0.1.0`.

Aucune configuration explicite `signingConfigs` ou `buildTypes.release` n’est présente dans le fichier audité. Le workflow Android ne lance que `assembleDebug` et publie un artefact temporaire de Debug. Il ne lance pas `assembleRelease`, ne signe pas une release et ne vérifie pas la signature d’un binaire final.

Aucune release GitHub ni page/fichier de téléchargement Android/APK n’a été trouvée dans l’arbre du dépôt audité. Cela ne prouve pas l’absence de tout hébergement externe, mais aucune preuve de distribution depuis le site NAXA n’est fournie par ce dépôt.

### Correction exigée

- créer une signature Release stable, stockée exclusivement dans les secrets sécurisés de CI ;
- séparer clairement Debug et Release ;
- produire un APK Release signé, vérifier son certificat, son identifiant de package et son numéro de version ;
- générer une empreinte SHA-256 et conserver un artefact de livraison versionné ;
- ajouter au site officiel NAXA le téléchargement de l’APK signé, les notes de version, la taille, l’empreinte, la version minimale Android et une procédure de mise à jour ;
- tester installation propre et mise à jour sur une version antérieure, sans réinitialiser les données utilisateur.

La diffusion demandée reste le téléchargement direct depuis le site NAXA ; aucune publication sur un store n’est requise par cet audit.

## 6. Notifications FCM

### Éléments présents

- `google-services.json` correspond au package Android `cm.naxa.app` ;
- `NaxaFirebaseMessagingService` reçoit les messages, crée une notification locale et traite un lien interne ;
- `FcmRegistrationRepository` enregistre et retire le jeton avec le Bearer de la session ;
- l’API `/api/notifications/fcm/register` authentifie le Bearer et rattache le jeton au compte ;
- le serveur `src/lib/firebase/fcm.ts` envoie par FCM HTTP v1 au moyen de `FIREBASE_SERVICE_ACCOUNT_JSON` ;
- le dispatcher push prévoit le canal FCM et un repli Web Push.

### Preuves manquantes

Le dépôt montre le code, mais cet audit ne démontre ni la présence valide du compte de service dans l’environnement de production, ni un envoi/réception FCM de bout en bout sur un téléphone Android réel, ni le comportement après révocation de permission, rotation du jeton et réinstallation.

**Statut : ORANGE — intégration codée, livraison réelle non homologuée.**

### Test exigé

Sur un téléphone physique, enregistrer un compte, activer la permission, vérifier le jeton serveur, envoyer un push depuis le dispatcher, confirmer la réception, l’ouverture du bon écran, la gestion d’un jeton renouvelé et la suppression à la déconnexion. Enregistrer les résultats et les horodatages. Ne jamais inclure de données médicales dans le contenu visible sur écran verrouillé.

## 7. Bluetooth et dispositifs médicaux

L’audit dédié `AUDIT_BLUETOOTH_NAXA.md` confirme les tests de décodeur, file AES-GCM/Android Keystore, capacité de 300 événements, refus de saturation sans éviction des événements déjà acceptés et programmation WorkManager sous contrainte réseau. L’instrumentation API 35 a passé 2 tests.

Il ne s’agit pas d’une homologation radio : aucun téléphone ni capteur BLE physique n’était connecté à l’environnement de validation. Le scan, la connexion, les notifications GATT, la perte/reprise radio, le redémarrage, les permissions et les restrictions OEM restent à tester sur matériel réel.

Les décodeurs Android couvrent plusieurs profils GATT SIG standards. La présence de 21 catégories dans le catalogue ne certifie pas 21 catégories ni tous les modèles commerciaux. Les appareils propriétaires ou dépourvus de profils pris en charge nécessitent un adaptateur et une recette propres à chaque modèle.

**Statut : ORANGE pour la validation matérielle et la compatibilité modèle par modèle.**

## 8. Compagnon Android de vérification des paiements

Le dépôt distingue trois variantes :

- Standard : Client et Promoteur, sans `RECEIVE_SMS` ni lecteur de notifications ;
- Professionnelle : Pharmacie et Partenaire, capture SMS/notifications après consentements et autorisations distincts ;
- Admin : capture SMS/notifications après consentements et autorisations distincts.

Le workflow construit les trois variantes Debug et contrôle statiquement la présence des composants de capture uniquement dans Professionnelle et Admin. Cela respecte le principe d’interdiction de lecture automatique sur les appareils Client et Promoteur payeur.

Le README du compagnon avertit toutefois que `RECEIVE_SMS` est une permission Android restreinte : le simple téléchargement et l’installation manuelle depuis un site ne garantissent pas l’autorisation de l’installateur. Les parcours d’installation, d’allowlist, de refus et de secours par partage manuel doivent être testés sur les modèles de téléphones ciblés.

Aucun package Release signé n’est produit par le workflow actuel pour ces trois variantes.

**Statut : VERT pour la matrice déclarative des permissions et les builds Debug contrôlés ; ORANGE pour l’installation réelle et les permissions restreintes ; ROUGE pour la livraison Release signée.**

## 9. Sécurité — constats favorables limités

- Le routage des rôles refuse l’accès à un espace non pris en charge, au lieu d’exposer un écran Client par défaut.
- Les jetons de session sont chiffrés avec Android Keystore.
- Le manifeste principal désactive la sauvegarde Android et le trafic HTTP en clair.
- Les permissions Bluetooth et notifications sont déclarées ; les contrôles runtime sont présents dans le code inspecté.
- Le compagnon sépare les permissions de capture selon la variante.

Ces contrôles statiques ne remplacent pas les tests de sécurité sur appareil, le test des révocations, le contrôle des journaux et la recette des permissions OEM.

## 10. Plan de correction priorisé

| Priorité | Action | Preuve de clôture attendue |
|---|---|---|
| P0 | Corriger l’injection Supabase dans la CI Android | Job échouant en configuration absente, APK de test avec configuration validée, connexion réelle réussie |
| P0 | Définir et livrer les espaces natifs par rôle | Parcours authentifiés Client, Promoteur, Pharmacie, Partenaire, Admin, Responsable, Comptable, Pharmacien, Stock et Livreur, avec tests d’isolation |
| P0 | Achever les parcours métier Client | Favoris, panier, commandes/réservations, paiement selon les règles NAXA, achats et suivi livraison réellement opérationnels |
| P1 | Définir la couverture fonctionnelle réelle du poste Admin natif | Opérations Admin requises et tests de permission, pas seulement des indicateurs |
| P1 | Créer la chaîne Release signée | Build Release, certificat stable, contrôle de signature, version et SHA-256 |
| P1 | Distribuer depuis le site NAXA | Installation propre et mise à jour prouvées depuis le site officiel |
| P1 | Homologuer FCM | Push réel reçu sur appareil, deep link et renouvellement de jeton testés |
| P1 | Homologuer BLE | Scénarios physiques documentés et modèle par modèle |
| P1 | Homologuer le compagnon paiements | Permissions restreintes, allowlist, refus et secours manuel testés sur téléphones cibles |
| P2 | Étendre la matrice Android | Tests au minimum sur versions Android supportées et constructeurs cibles |

## 11. Critères obligatoires pour déclarer l’application AU VERT

L’application Android complète ne sera AU VERT qu’après :

1. résolution du défaut de configuration Supabase CI et preuve de connexion de l’APK effectivement construit ;
2. livraison des fonctions et espaces natifs requis par les règles métier NAXA, sans contourner les contrôles de rôle ;
3. tests fonctionnels de bout en bout sur les principaux parcours Client et professionnels ;
4. APK Release signé avec une clé de production stable ;
5. installation et mise à jour confirmées depuis le site officiel NAXA ;
6. notification FCM réelle validée sur téléphone ;
7. essais BLE physiques sur chaque modèle annoncé compatible ;
8. compagnon de paiement installé et permissions de capture éprouvées dans les limites de chaque profil ;
9. documentation et rapports de test attachés au commit audité.

## 12. Actions effectuées pendant cet audit

- Inspection du code Android principal, du routage des rôles, des écrans Client/Admin, des dépôts d’authentification et FCM, des manifestes, de Gradle, des workflows et des documents de compatibilité.
- Vérification des runs GitHub Actions et des artefacts disponibles.
- Comparaison des commits entre le build Android réussi et le HEAD courant.
- **Aucune modification du code applicatif.**
- **Aucune migration ou modification Supabase.**
- **Aucun changement de variable/secrets.**
- **Aucun déploiement Vercel.**
- Aucun APK Debug existant promu ou présenté comme une release.

**Décision finale : application Android NAXA non complète. Le socle natif et ses tests sont encourageants, mais la couverture fonctionnelle, la configuration de l’APK CI, la signature Release, la distribution site et les homologations terrain restent à fermer avant livraison.**

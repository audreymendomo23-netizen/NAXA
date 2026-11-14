# Audit source-code Android NAXA — nouvelle inspection

Date : 14 novembre 2026  
Branche : `main`  
HEAD inspecté : `ac52c71bd07cfd993f3175024b8ab7848fa0d4d4`  
Périmètre : application native principale, compagnon de paiement, configuration Gradle, workflows et tests sources.

## 1. Méthode et décision

Cet audit est fondé sur l'inspection directe du code source présent sur `main`. Les anciens rapports, les fichiers README et les conclusions écrites antérieures n'ont pas servi de preuves pour décider du statut.

**DÉCISION : ROUGE — le code Android ne constitue pas encore une application NAXA complète et exploitable sur l'ensemble des rôles.**

Le dépôt contient une vraie application native Kotlin/Jetpack Compose, des appels API réels, des fonctions Client partielles, un tableau de bord Admin restreint, un service BLE natif et un compagnon Android de paiement. Mais plusieurs parcours métier sont absents, un défaut de configuration empêche l'authentification dans le binaire produit par le workflow actuel, et des défauts de gestion de file et de capture affaiblissent les fonctions de fond.

Aucun changement de code applicatif, de secret, de base Supabase ou de production n'a été effectué pendant cette inspection.

## 2. Défauts bloquants — application principale

### P0 — Configuration Supabase absente du build CI

Fichiers concernés :
- `android/app/build.gradle.kts`
- `.github/workflows/android-native-build.yml`
- `android/app/src/main/java/cm/naxa/app/AuthRepository.kt`

Constat dans le code :
- Gradle lit `SUPABASE_URL` et `SUPABASE_ANON_KEY` depuis les propriétés Gradle ou les variables d'environnement.
- Les deux valeurs ont une valeur de repli vide.
- Le workflow Android lance `:app:testDebugUnitTest :app:assembleDebug`, sans transmettre ces deux paramètres par `env`, `-P` ou une étape de configuration.
- `AuthRepository.signIn()` appelle `requireConfigured()`, qui refuse de démarrer l'authentification si l'une des valeurs est vide.
- `restoreSession()` retourne directement `null` lorsque ces paramètres sont vides.
- Les dépôts Client, notifications et suivi Bluetooth utilisent eux aussi ces paramètres pour accéder à Supabase.

Conséquence : sur le runner du workflow tel qu'il est écrit, l'APK Debug peut être compilé, mais il ne dispose pas de la configuration nécessaire pour connecter un compte. Un build réussi ne prouve donc pas que le binaire fonctionne.

Correction exigée :
1. Injecter les deux valeurs depuis les variables/secrets GitHub prévus.
2. Faire échouer le build avant Gradle si une valeur manque.
3. Ajouter un test de configuration compilée puis un vrai test d'authentification sur l'APK qui sera distribué.

### P0 — Les rôles professionnels sont refusés par le routage natif

Fichiers concernés :
- `android/app/src/main/java/cm/naxa/app/NativeRoleRouting.kt`
- `android/app/src/main/java/cm/naxa/app/AuthRepository.kt`
- `android/app/src/main/java/cm/naxa/app/MainActivity.kt`

Constat dans le code :
- `supportsClientWorkspace()` n'accepte que le couple `client / client`.
- `supportsAdminWorkspace()` n'accepte que le couple `admin / admin`.
- Les rôles Promoteur, Pharmacie, Partenaire, Caisse, Responsable, Comptable, Pharmacien, Gestionnaire de stock et Livreur sont routés vers `UnsupportedNativeRoleScreen`.
- Cet écran indique explicitement que l'espace professionnel n'est pas disponible.

Le comportement fail-closed évite de montrer les données Client à un professionnel, ce qui est correct du point de vue du cloisonnement. Mais il signifie également que ces professionnels ne peuvent pas utiliser leurs postes NAXA dans l'application native.

**Conséquence :** l'application Android ne couvre pas les rôles de l'écosystème NAXA.

### P0 — Les parcours métier Client ne sont pas complets

Fichier concerné : `android/app/src/main/java/cm/naxa/app/MainActivity.kt`

La navigation construite dans `NativeHome()` comporte cinq destinations : Accueil, Rechercher, Scanner, Achats et Profil.

Les écrans qui y sont réellement raccordés sont :
- catalogue de médicaments ;
- recherche de pharmacies proches ;
- scanner local ;
- historique des réservations/achats ;
- paramètres de notifications.

En revanche, le parcours natif ne propose pas les fonctions qui permettraient d'achever une opération Client :
- panier opérationnel ;
- création et validation d'une commande ou réservation depuis le catalogue ;
- processus de paiement intégré au parcours de commande ;
- suivi de livraison jusqu'à la remise ;
- gestion des favoris.

L'onglet Achats affiche un historique ; il ne crée pas une commande. La carte « Dispositifs médicaux » de l'accueil est une carte de présentation, pas un parcours de catalogue transactionnel.

**Conséquence :** le Client peut consulter certaines données, mais ne peut pas effectuer dans cette application native le cycle complet d'achat NAXA.

## 3. Poste Admin natif

Fichiers concernés :
- `android/app/src/main/java/cm/naxa/app/NativeAdminDashboardScreen.kt`
- `android/app/src/main/java/cm/naxa/app/AdminDashboardRepository.kt`

Le poste Admin natif charge un tableau d'indicateurs et un journal d'activité via l'API authentifiée. Les actions visibles sont essentiellement actualiser, ouvrir les notifications et quitter le poste.

Le dépôt Admin expose un chargement de données ; l'écran inspecté ne contient pas les formulaires et actions permettant de gérer les opérations Admin 360 : comptes, pharmacies, validations, suspensions, paiements, paramètres, contrôle métier et sécurité.

**Statut : ORANGE pour le tableau de bord de consultation ; ROUGE pour un poste Admin complet.**

## 4. Notifications Firebase — code présent, enrôlement incomplet

Fichiers concernés :
- `android/app/src/main/java/cm/naxa/app/NaxaFirebaseMessagingService.kt`
- `android/app/src/main/java/cm/naxa/app/FcmRegistrationRepository.kt`
- `android/app/src/main/java/cm/naxa/app/MainActivity.kt`
- `android/app/src/main/java/cm/naxa/app/NativeAdminDashboardScreen.kt`

La réception FCM et l'enregistrement d'un jeton sont codés. Le fichier `google-services.json` est présent et le plugin Google Services est appliqué ; l'absence de valeurs Firebase dans les propriétés Gradle ne suffit donc pas à conclure que Firebase n'est pas configuré : le plugin peut générer la configuration native à partir de ce fichier.

Défaut de parcours trouvé :
- `onNewToken()` tente l'enregistrement dès qu'un jeton change.
- Si aucun compte n'est connecté à ce moment-là, l'enregistrement échoue et l'exception est ignorée.
- Le code ne réessaie pas systématiquement au moment de la connexion.
- Le bouton explicite d'inscription FCM est dans `NativeNotificationSettings()`, raccordé au Profil de l'espace Client.
- Le poste Admin natif ne contient pas ce contrôle d'activation/enrôlement.
- Les rôles professionnels sont actuellement exclus du routage natif.

Conséquence : l'inscription FCM après connexion n'est pas garantie ; en particulier, aucun parcours explicite n'enrôle le téléphone Admin depuis son poste natif.

Correction exigée : déclencher et vérifier l'enregistrement FCM après chaque session authentifiée, quel que soit le rôle autorisé, puis rendre l'état d'enrôlement et les erreurs visibles. Tester un vrai push sur appareil.

## 5. Défauts du moteur Bluetooth en arrière-plan

Fichiers concernés :
- `android/app/src/main/java/cm/naxa/app/NaxaBleForegroundService.kt`
- `android/app/src/main/java/cm/naxa/app/NaxaBleMeasurementSyncWorker.kt`
- `android/app/src/main/java/cm/naxa/app/MainActivity.kt`
- `android/app/src/main/java/cm/naxa/app/SuiviBluetoothRepository.kt`

### P1 — La file n'est pas isolée par compte

Constat :
- La file chiffrée `QUEUE_KEY` est commune à l'application.
- `stopForLogout()` vide les sessions BLE, mais ne purge ni ne partitionne la file des événements.
- Le Worker ignore les événements dont `ownerUserId` ne correspond pas au compte actuellement connecté ; il ne les acquitte pas.
- L'écran de suivi ignore également les événements d'un autre propriétaire.
- La capacité de 300 événements est évaluée sur la file globale.

Scénario reproductible à partir du code :
1. Le compte A accumule des mesures hors ligne.
2. Le compte A se déconnecte ; ses événements restent dans la file.
3. Le compte B se connecte.
4. Le Worker ignore les événements de A sans les acquitter.
5. Ces événements occupent toujours la capacité commune de B et peuvent finir par bloquer ses propres connexions.

La séparation par propriétaire évite la réattribution des mesures, mais le stockage commun ne gère pas le changement de compte.

Correction exigée : partitionner la file par utilisateur ou mettre en place une stratégie explicite et sûre de conservation/vidage des files à la déconnexion, sans réattribuer une mesure à un autre compte.

### P1 — Le Worker peut terminer avec succès sans vider la file

Dans `NaxaBleMeasurementSyncWorker.drainPendingMeasurements()`, si `AuthRepository.restoreSession()` renvoie `null`, la fonction retourne normalement. Le Worker retourne donc `Result.success()` alors que les mesures restent dans la file.

Le code relance le Worker lorsque l'écran Suivi connecté est ouvert et lorsqu'un nouvel événement de mesure arrive. Il ne garantit pas un nouvel essai au moment où une session est restaurée après cette terminaison.

Correction exigée : conserver un état de reprise explicite et reprogrammer la file après authentification/retour réseau, sans marquer une synchronisation non effectuée comme terminée.

### P1 — Les événements d'état dépendent de l'écran Compose

Le service BLE écrit dans la même file :
- mesures ;
- appareils détectés ;
- états de connexion/déconnexion ;
- état de scan ;
- informations d'appareil ;
- reconnexions et erreurs.

Le Worker de fond ne consomme que les événements de type `measurement`. Les autres événements sont acquittés par la boucle de lecture dans `NativeSuiviBluetoothScreen`.

Lorsque l'écran est fermé, le service BLE peut continuer à émettre des événements d'état, mais le consommateur Compose n'est plus actif. Ces événements restent dans la file et peuvent contribuer à sa saturation, même lorsque les mesures sont synchronisées par WorkManager.

Correction exigée : séparer les événements d'interface éphémères des mesures durables ou ajouter un consommateur de fond qui nettoie les événements non-mesure sans supprimer les mesures en attente.

### Points positifs établis directement dans le code

- Service BLE natif Android distinct de l'écran Compose.
- File chiffrée AES-GCM avec clé Android Keystore.
- Capacité bornée à 300 événements, sans éviction des événements précédemment acceptés lorsque la file est pleine.
- Worker unique sous contrainte réseau avec backoff exponentiel.
- Révalidation de session et de propriétaire avant synchronisation.
- Contrôle du consentement de famille avant enregistrement.
- Clé d'événement stable pour prévenir les doublons.
- ACK de mesure après persistance confirmée ou vérification des clés après conflit 409.
- Décodage de plusieurs profils GATT SIG standards.

Ces éléments ne démontrent pas la compatibilité radio de tous les appareils ni une homologation terrain.

## 6. Compagnon Android de paiement

Fichiers concernés :
- `android/payment-companion/app/src/main/java/cm/naxa/paymentcompanion/MainActivity.kt`
- `NaxaApi.kt`
- `SmsReceiver.kt`
- `NaxaNotificationListenerService.kt`
- `SmsCaptureGate.kt`
- `NotificationCaptureGate.kt`
- `SmsPaymentParser.kt`
- manifestes `main`, `professional` et `admin`

### Points correctement cloisonnés dans le code

- La variante Standard n'intègre ni `RECEIVE_SMS`, ni `SmsReceiver`, ni le lecteur de notifications.
- La collecte SMS exige le rôle autorisé, le consentement local explicite et la permission Android.
- Le lecteur de notifications exige un consentement et n'accepte que les profils Pharmacie, Partenaire et Admin.
- Les notifications sont filtrées localement par une liste de packages d'applications de paiement.
- Les SMS sont filtrés par expéditeur exact `OrangeMoney` ou `MobileMoney`.
- Client et Promoteur ne passent pas les gardes de capture automatique.
- Le formulaire Client utilise le montant attendu de la commande et la date locale de Douala comme valeurs de départ ; les valeurs reconnues du SMS remplacent les valeurs générées et les champs restent modifiables.
- Le partage volontaire et la revue manuelle sont présents.

### P1 — Aucun stockage durable des captures lorsque l'envoi échoue

Dans `SmsReceiver`, après réception, le SMS est envoyé par une tâche sur un exécuteur. Si l'envoi échoue, le code enregistre seulement un dernier statut et un message d'erreur dans le coffre ; le SMS lui-même n'est pas placé dans une file durable de reprise.

Dans `NaxaNotificationListenerService`, l'échec d'envoi met à jour un statut d'erreur, sans file durable ni reprise WorkManager.

Conséquence : une perte réseau ou une indisponibilité API au moment de la capture peut faire perdre l'événement automatique. Le rapprochement devra alors dépendre d'un partage manuel ou d'une autre preuve.

Correction exigée : persister localement les événements de manière sécurisée, avec identifiant idempotent, réessai réseau et suppression seulement après accusé serveur.

### P1 — Appel réseau dans le cycle de vie d'un BroadcastReceiver

`SmsReceiver` utilise `goAsync()`, puis appelle le réseau via `HttpClient`. Le client HTTP prévoit 8 secondes de connexion et 12 secondes de lecture, sans compter un éventuel renouvellement de session Supabase. Ce chemin peut dépasser la fenêtre de traitement d'un BroadcastReceiver Android.

C'est un risque de fiabilité identifié dans le code, pas la preuve d'un arrêt observé sur un téléphone. Le traitement devrait être transféré à une tâche durable compatible avec les limites Android.

### P1 — Consentement SMS Admin non synchronisé comme celui des profils professionnels

`NaxaApi.setSmsConsent()` accepte uniquement les rôles Pharmacie et Partenaire. Dans `applySmsConsentChoice()`, l'appel distant est exécuté uniquement pour la variante professionnelle. La variante Admin conserve donc son consentement SMS dans le stockage local ; ce parcours ne démontre pas l'enregistrement distant ni le retrait distant du consentement Admin.

Correction exigée : définir et tester un contrat serveur explicite pour l'accord et le retrait du consentement de capture Admin.

### P2 — Statut Admin peut annoncer une capture active sans enrôlement complet des deux canaux

L'enrôlement Admin essaie de créer les appareils Orange Money et MTN MoMo dans un même bloc. Si le premier appel échoue, le second n'est pas tenté. Le code conserve `admin_sms_enrollment_ready`, mais `refreshCaptureStatus()` annonce la capture active sur la seule base du consentement local et de la permission Android, sans vérifier que les deux appareils/canaux ont été enrôlés.

Correction exigée : contrôler séparément l'état de chaque canal et afficher une disponibilité réelle par opérateur.

## 7. Signature et production APK

Fichiers concernés :
- `android/app/build.gradle.kts`
- `.github/workflows/android-native-build.yml`
- `android/payment-companion/app/build.gradle`
- `.github/workflows/android-native-build.yml`

Dans le code Gradle de l'application principale :
- `versionCode = 1`, `versionName = "0.1.0"` ;
- aucune configuration `signingConfigs` explicite ;
- aucun `buildTypes.release` configuré.

Dans le workflow :
- application principale : `:app:testDebugUnitTest :app:assembleDebug` ;
- compagnon : assemblage et tests des variantes `standardDebug`, `professionalDebug`, `adminDebug` ;
- aucun `assembleRelease` ;
- aucune signature Release ;
- aucune vérification de certificat ;
- aucune publication d'un APK Release stable vers le site NAXA.

Le code inspecté produit donc des APK Debug de test, pas les APK Release signés destinés à être installés par les utilisateurs.

**Statut : ROUGE — chaîne de livraison Release absente du code contrôlé.**

Correction exigée : configurer une signature de production persistante stockée dans les secrets CI, compiler les variantes Release, vérifier package/version/certificat, calculer SHA-256 et intégrer le téléchargement versionné au site officiel NAXA.

## 8. Tests présents dans le dépôt — couverture réelle du code

Les tests sources couvrent notamment :
- décodage de certains profils GATT ;
- politique de capacité de file et intégration Android Keystore/WorkManager ;
- mapping des familles de consentement ;
- routage fermé des rôles ;
- parsing du SMS Orange/MTN ;
- gardes de capture SMS et notifications ;
- parsing de l'historique Client.

Les tests inspectés ne couvrent pas :
- authentification réelle et renouvellement de session ;
- comportement d'un APK construit avec configuration CI ;
- parcours complet Client de panier à livraison ;
- espaces métiers professionnels ;
- opérations Admin 360 ;
- réception FCM réelle ;
- file de capture SMS/notifications hors ligne et reprise ;
- changement de compte avec événements BLE en attente ;
- long fonctionnement BLE écran fermé avec déconnexions répétées ;
- interopérabilité de chaque modèle de capteur.

Je n'ai pas exécuté Gradle dans cette session : aucun checkout local du dépôt, Gradle ou Android SDK n'est disponible dans l'environnement d'exécution. Les tests listés ci-dessus sont donc une revue des fichiers de test, pas un nouveau résultat d'exécution. Je ne transforme pas cette inspection en faux PASS.

## 9. Plan de correction ordonné

| Priorité | Correction | Test qui doit fermer le point |
|---|---|---|
| P0 | Injecter les variables Supabase dans le build Android | Build avec contrôle de présence, démarrage et authentification d'un compte réel sur l'APK construit |
| P0 | Implémenter les postes Promoteur, Pharmacie, Partenaire, Responsable, Comptable, Pharmacien, Stock et Livreur | Parcours métier par rôle et tests négatifs de cloisonnement |
| P0 | Compléter le parcours Client natif | Favoris, panier, réservation/commande, paiement, achats et suivi livraison de bout en bout |
| P1 | Compléter les opérations Admin natives | Actions Admin 360 autorisées et tests de permission |
| P1 | Corriger la file BLE multi-compte | Mesures hors ligne du compte A, déconnexion, connexion compte B, aucune fuite ni saturation croisée |
| P1 | Découpler les événements d'interface de la file de mesures | BLE actif écran fermé, reconnexions et états répétés sans accumulation de la file durable |
| P1 | Corriger la reprise Worker lorsque la session est absente | Perte/retour de session et reprise automatique après authentification |
| P1 | Rendre l'enrôlement FCM systématique par rôle | Connexion Client et Admin, jeton enregistré, push réel reçu, jeton renouvelé et désinscription |
| P1 | Ajouter une file durable au compagnon | Capture SMS/notification hors ligne, reprise, ACK idempotent |
| P1 | Synchroniser le consentement SMS Admin | Accord/retrait local et serveur cohérents, refus de capture après retrait |
| P1 | Créer la chaîne Release signée | APK Release signé vérifié, mise à jour d'une version précédente sans perte de données |
| P1 | Publier les APK Release depuis le site NAXA | Installation propre et mise à jour depuis le site officiel |
| P1 | Homologuer BLE et le compagnon sur appareils réels | Rapport par téléphone, version Android, opérateur et modèle de capteur |

## 10. Verdict final

**L'application Android NAXA n'est pas complète.**

Le code prouve l'existence d'un socle natif réel, de fonctions Client de consultation, d'un tableau de bord Admin limité, d'un compagnon de paiement spécialisé et d'un moteur BLE avancé. Il ne prouve pas une couverture de l'écosystème NAXA ; plusieurs postes sont explicitement bloqués par le routage et le cycle d'achat Client n'est pas présent.

Les défauts P0 sont la configuration Supabase absente du workflow et l'absence des postes professionnels/parcours métier nécessaires. Les défauts P1 touchent la reprise et l'isolation des événements BLE, l'enrôlement FCM Admin, la durabilité des captures de paiement et la chaîne de production APK signée.

**Statut global : ROUGE. Aucun APK Debug existant ne doit être traité comme une version Android de production prête à diffuser.**

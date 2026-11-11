# NAXA Payment Companion (Android)

## Objectif

Compagnon natif destiné aux téléphones enrôlés Promoteur et Admin. Il écoute uniquement le broadcast Android `SMS_RECEIVED` puis conserve l'adresse d'origine brute fournie par `SmsMessage.getOriginatingAddress()`. Il ne consulte ni les contacts, ni la base SMS, ni les autres conversations.

Canaux acceptés :
- `OrangeMoney` → `orange_money`
- `MobileMoney` → `mtn_momo`

Les autres expéditeurs, notamment les expéditeurs numériques, sont ignorés localement. Le corps du SMS est gardé en mémoire seulement le temps du rapprochement HTTP ; il n'est ni écrit dans les préférences, ni dans les logs.

## Configuration de construction

- Android Gradle Plugin : 9.4.0.
- Gradle : 9.6.0.
- JDK : 17 ou supérieur.
- compileSdk : 37 ; targetSdk : 36 ; minSdk : 26.
- Aucune dépendance AndroidX/SDK tierce n'est requise.

Ouvrir `android/payment-companion` dans Android Studio puis laisser Gradle configurer le projet. Le projet n'inclut pas le wrapper binaire `gradle-wrapper.jar` ; Android Studio peut générer le wrapper localement.

## Enrôlement

1. Installer le compagnon depuis une source de distribution autorisée pour la permission SMS.
2. Ouvrir l'application, saisir l'URL HTTPS NAXA, URL Supabase, clé publique Supabase, e-mail et mot de passe.
3. Choisir Promoteur ou Administrateur.
4. L'application obtient la session Supabase, enrôle l'installation auprès de l'API NAXA et chiffre les jetons avec Android Keystore.
5. Accorder `RECEIVE_SMS` si Android et l'installateur l'autorisent.

Pour le compte Admin, le compagnon demande l'enrôlement Orange et MTN séparément. Il faut auparavant configurer les deux destinations marchandes dans le cockpit Admin. Pour le Promoteur, un seul appareil sert à préparer les intents et transmettre les SMS du compte payeur.

## Limite de distribution critique

`RECEIVE_SMS` est une permission dangereuse et *hard-restricted*. Google Play Protect peut bloquer automatiquement l'installation d'une application téléchargée depuis un navigateur ou une autre source Internet lorsqu'elle déclare `RECEIVE_SMS`. Cela concerne le téléchargement direct depuis un site NAXA. Ne pas recommander de désactiver Play Protect et ne pas tenter de contourner la restriction.

La capture automatique nécessite une distribution/installation qui permet légalement et techniquement l'allowlist de la permission restreinte (par exemple un canal d'entreprise géré ou un programme de distribution approuvé). Tant que cette voie n'est pas validée sur un vrai téléphone, le fallback officiel reste le formulaire manuel/SMS collé dans NAXA et la confirmation Admin.

## Contrat backend

- Promoteur : `POST /api/promoteur/paiements/device/register` puis `POST /api/promoteur/paiements/capture`.
- Admin : `POST /api/admin/paiements/device/register` pour Orange et MTN, puis `POST /api/admin/paiements/capture`.
- Les appels transmettent `deviceId`, `deviceToken`, `canal`, `smsText`, `senderOriginAddress` et `smsReceivedAt`.
- Les routes backend vérifient session Auth, appareil, expéditeur brut, canal, montant, payeur, destination, référence et délai.
- Le téléphone Admin ne renouvelle un abonnement que si la RPC serveur réussit ; toute ambiguïté reste en revue manuelle.

## Tests et statut

Le code source Android est ajouté, mais le build n'est pas certifié : l'environnement de développement actuel n'a ni Android SDK, ni Gradle, ni ADB. Aucun APK n'est généré, aucun appareil réel n'est enrôlé et aucun SMS opérateur n'a été testé avec une SIM MTN/Orange.

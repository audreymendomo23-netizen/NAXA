# NAXA Payment Companion (Android)

## Implémentation
Le compagnon Android est désormais écrit en Kotlin. Les six sources Java ont été converties sans changer les routes HTTP NAXA, les rôles Promoteur/Admin, le chiffrement Android Keystore ni le filtrage local des SMS.

## Objectif et confidentialité
Le compagnon écoute uniquement le broadcast Android `SMS_RECEIVED` et conserve l'adresse d'origine brute fournie par Android. Il ne consulte ni les contacts, ni la base SMS, ni les autres conversations.
- `OrangeMoney` → `orange_money`
- `MobileMoney` → `mtn_momo`
Les autres expéditeurs, notamment les expéditeurs numériques, sont ignorés. Le corps du SMS reste en mémoire pendant le rapprochement HTTP et n'est ni enregistré dans les préférences, ni écrit dans les logs.

## Configuration
- Android Gradle Plugin : 9.4.0.
- Kotlin Android plugin : 2.3.10.
- Gradle : 9.6.0 ; JDK 17 ou supérieur.
- compileSdk 37 ; targetSdk 36 ; minSdk 26.
- Aucune dépendance AndroidX tierce requise.
Ouvrir `android/payment-companion` dans Android Studio. Le wrapper binaire `gradle-wrapper.jar` n'est pas inclus.

## Enrôlement
Saisir les URL HTTPS NAXA et Supabase, la clé publique Supabase, l'e-mail et le mot de passe, puis choisir Promoteur ou Admin. La session Supabase et les jetons appareil sont chiffrés avec Android Keystore. L'enrôlement Admin enregistre séparément Orange et MTN.

## Limite critique de distribution
`RECEIVE_SMS` est une permission restreinte. Play Protect peut bloquer une application téléchargée depuis un navigateur ou une autre source Internet. Ne pas désactiver Play Protect et ne pas contourner cette restriction. La capture automatique exige un canal de distribution autorisé permettant l'allowlist de cette permission. Tant que ce canal n'est pas validé sur un vrai téléphone, le fallback officiel reste le formulaire manuel/SMS collé dans NAXA et la confirmation Admin.

## Contrat backend conservé
- Promoteur : `POST /api/promoteur/paiements/device/register` et `POST /api/promoteur/paiements/capture`.
- Admin : `POST /api/admin/paiements/device/register` et `POST /api/admin/paiements/capture`.
- Champs conservés : `deviceId`, `deviceToken`, `canal`, `smsText`, `senderOriginAddress`, `smsReceivedAt`.
- Le serveur reste seul décisionnaire de la validation du paiement et du renouvellement d'abonnement.

## Statut
Sources migrées vers Kotlin dans le dépôt. Build Gradle, APK, enrôlement sur appareil et essais réels avec SIM MTN/Orange non certifiés à ce stade.

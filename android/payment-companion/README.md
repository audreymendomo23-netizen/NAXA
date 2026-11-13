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
- Kotlin : compilateur intégré à Android Gradle Plugin 9.4.0 (aucun plugin Kotlin redondant).
- Gradle : 9.6.0 ; JDK 17 ou supérieur.
- compileSdk 36 ; targetSdk 36 ; minSdk 26.
- Aucune dépendance AndroidX tierce requise.
Ouvrir `android/payment-companion` dans Android Studio. Le wrapper binaire `gradle-wrapper.jar` n'est pas inclus.

## Enrôlement
Saisir les URL HTTPS NAXA et Supabase, la clé publique Supabase, l'e-mail et le mot de passe, puis choisir Promoteur ou Admin. La session Supabase et les jetons appareil sont chiffrés avec Android Keystore. L'enrôlement Admin enregistre séparément Orange et MTN.

## Limite critique de distribution
`RECEIVE_SMS` est une permission Android hard-restricted (fortement restreinte par le système). Play Protect peut bloquer une application téléchargée depuis un navigateur ou une autre source Internet. Ne pas recommander de désactiver Play Protect ni de contourner cette restriction. La capture automatique exige un canal de distribution autorisé permettant l'allowlist de cette permission. Tant que ce canal n'est pas validé sur un vrai téléphone, le fallback officiel reste le formulaire manuel/SMS collé dans NAXA et la confirmation Admin.

## Contrat backend conservé
- Promoteur : `POST /api/promoteur/paiements/device/register` et `POST /api/promoteur/paiements/capture`.
- Admin : `POST /api/admin/paiements/device/register` et `POST /api/admin/paiements/capture`.
- Champs conservés : `deviceId`, `deviceToken`, `canal`, `smsText`, `senderOriginAddress`, `smsReceivedAt`.
- Le serveur reste seul décisionnaire de la validation du paiement et du renouvellement d'abonnement.

## Statut et preuves CI

- Sources Android converties en Kotlin ; aucun fichier source Java ne subsiste dans le module compagnon.
- Dernière preuve native antérieure : [Android native build run 43418145728](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43418145728), commit `c986f1c715bcc1e6a5996e4f20d175589a767999` : compilation Kotlin, `testDebugUnitTest`, génération APK Debug et upload de l'artefact réussis.
- Les commits Web/backup ultérieurs n'ont pas modifié le code Android. Le prochain push de ce README déclenche à nouveau le workflow natif sur le HEAD courant de `main`.

Restent non certifiés : installation sur téléphone réel, enrôlement Promoteur/Admin, essais avec SIM MTN et Orange, réception des SMS et autorisation officielle de `RECEIVE_SMS` pour le canal de distribution retenu. L'APK Debug et le succès CI ne prouvent pas ces étapes matérielles.

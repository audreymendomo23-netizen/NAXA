# NAXA Payment Companion (Android)

## Implémentation
Le compagnon Android est écrit en Kotlin. Les six sources Java ont été converties sans changer les routes HTTP NAXA, les rôles Promoteur/Admin, le chiffrement Android Keystore ni le filtrage local des expéditeurs SMS.

## Distribution privée
NAXA Paiement est une application fermée, non destinée au grand public et non distribuée par le Play Store. Les canaux prévus sont :
- transfert privé par Bluetooth ;
- téléchargement depuis le site officiel NAXA ;
- partage direct du fichier APK.

Le canal de transfert du fichier ne change pas les contrôles d'installation Android. L'application ne demande pas de désactiver Play Protect et ne contourne pas les restrictions système.

## Consentement et autorisation SMS — règle obligatoire
La capture automatique est désactivée par défaut et repose sur trois conditions cumulatives :
1. **Consentement explicite dans l'application** : l'utilisateur coche « J'autorise explicitement NAXA Paiement à traiter ces SMS de transaction ». Le choix est stocké dans le coffre chiffré Android Keystore. Décocher la case désactive immédiatement le traitement côté application.
2. **Permission Android** : après le consentement et l'enrôlement, l'application demande séparément `RECEIVE_SMS` au système. Le consentement de l'application ne remplace jamais la permission Android.
3. **Expéditeur autorisé** : seuls les identifiants exacts `OrangeMoney` et `MobileMoney` sont acceptés. Les autres expéditeurs sont ignorés.

Le compagnon transmet par HTTPS le texte du SMS reçu provenant de ces expéditeurs pour le rapprochement du paiement. Il ne consulte ni les contacts, ni l'historique SMS, ni les messages provenant d'autres expéditeurs. Le serveur reste le seul décideur de la validation et du renouvellement.

### Restriction Android à respecter
La permission `android.permission.RECEIVE_SMS` est classée par Android comme dangereuse et **hard-restricted**. Pour que le système puisse l'accorder, l'installateur enregistré doit aussi placer cette permission sur la liste autorisée (*allowlist*). Le dialogue de consentement utilisateur seul ne peut pas lever cette restriction.

Cela doit être vérifié sur les appareils cibles pour chacun des canaux d'installation prévus (Bluetooth, site NAXA, APK direct). Si Android refuse la permission parce que l'installateur ne l'a pas autorisée, l'application affiche clairement l'état bloqué et n'effectue aucune capture automatique. Ne jamais contourner cette restriction ni désactiver Play Protect. Le parcours manuel de déclaration/vérification du paiement reste disponible dans NAXA.

L'utilisateur peut retirer son consentement dans l'application à tout moment. Il peut également retirer la permission Android dans Paramètres > Applications > NAXA Paiement > Autorisations > SMS.

## Configuration technique
- Android Gradle Plugin : 9.4.0.
- Kotlin : compilateur intégré à Android Gradle Plugin 9.4.0.
- Gradle : 9.6.0 ; JDK 17.
- compileSdk 36 ; targetSdk 36 ; minSdk 26.
- Version Android : 1.2.0 (versionCode 3).
- Aucune dépendance AndroidX tierce requise.
Ouvrir `android/payment-companion` dans Android Studio. Le wrapper binaire `gradle-wrapper.jar` n'est pas inclus.

## Enrôlement
Saisir les URL HTTPS NAXA et Supabase, la clé publique Supabase, l'e-mail et le mot de passe, puis choisir Promoteur ou Admin. La session Supabase et les jetons appareil sont chiffrés avec Android Keystore. L'enrôlement Admin enregistre séparément Orange et MTN.

## Contrat backend conservé
- Promoteur : `POST /api/promoteur/paiements/device/register` et `POST /api/promoteur/paiements/capture`.
- Admin : `POST /api/admin/paiements/device/register` et `POST /api/admin/paiements/capture`.
- Champs conservés : `deviceId`, `deviceToken`, `canal`, `smsText`, `senderOriginAddress`, `smsReceivedAt`.
- Le serveur reste seul décisionnaire de la validation du paiement et du renouvellement d'abonnement.

## Tests et statut
- Tests existants de classification des expéditeurs : six tests unitaires.
- Tests ajoutés du verrou consentement + permission Android + expéditeur : cinq tests unitaires.
- Le récepteur re-vérifie le consentement chiffré et la permission système avant de lire/transmettre le corps du SMS.
- Le build Kotlin / tests et la génération de l'APK Debug doivent être confirmés par le workflow déclenché après les changements de cette version.
- Les tests sur téléphone réel restent nécessaires pour confirmer le comportement d'installation et l'allowlist `RECEIVE_SMS` sur les versions Android et appareils retenus.

La construction du consentement est intégrée au code ; la validation des droits installateur et le test terrain restent distincts.

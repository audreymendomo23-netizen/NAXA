# NAXA Paiement Android — distribution privée

La référence métier est l'architecture des paiements dans ../../docs/ARCHITECTURE_PAIEMENT_PILOTE.md.

## Variantes APK privées — sans Play Store

| Variante | Profils | Permissions / accès |
|---|---|---|
| Standard cm.naxa.paymentcompanion | Client, Promoteur | Pas de RECEIVE_SMS et pas de lecteur de notifications. Partage volontaire du SMS uniquement. |
| Professionnelle cm.naxa.paymentcompanion.professional | Pharmacie, Partenaire | RECEIVE_SMS et NotificationListener, chacun après consentement distinct et autorisation Android correspondante. |
| Admin cm.naxa.paymentcompanion.admin | Administrateur | RECEIVE_SMS et NotificationListener, chacun après consentement distinct et autorisation Android correspondante. |

L'installation se fait par APK depuis le canal officiel NAXA. Android peut demander d'autoriser cette source à installer des applications ; NAXA ne contourne pas cet avertissement.

Les variantes Professionnelle et Admin demandent séparément RECEIVE_SMS après consentement. Android classe cette permission comme dangereuse et hard-restricted : l'installateur doit autoriser l'application dans l'allowlist des permissions restreintes. Le simple téléchargement APK, le transfert Bluetooth ou le réglage « installer des applications inconnues » ne garantissent pas cette allowlist. Tester l'installateur et chaque modèle de téléphone cible ; ne jamais désactiver Play Protect ni contourner Android. Si l'autorisation est refusée, le SMS bénéficiaire devra être partagé manuellement depuis l'application Messages ou rapproché par une autre source disponible. Le Client conserve toujours le partage volontaire et n'obtient jamais RECEIVE_SMS.

## Règles de lecture des notifications

Android accorde au lecteur un accès technique au flux général des notifications du téléphone. L'utilisateur doit activer cet accès spécial dans les paramètres Android après avoir donné son consentement dans NAXA.

Le service :
- refuse toujours le profil Client ;
- n'agit que pour les rôles pharmacie, partenaire et admin, avec consentement ;
- filtre localement les paquets des applications de paiement répertoriées dans PaymentNotificationSourceClassifier ;
- transmet uniquement un message qui passe les filtres de forme et les règles de collecte du profil ;
- ne transmet pas le reste des notifications ;
- classe chaque notification comme candidat non authentifié et ne confirme aucun paiement.

Le titre d'une notification n'est pas l'adresse d'origine brute d'un SMS. Pour cette raison, une notification Admin est transmise à la revue manuelle et jamais à l'API de capture SMS authentifiée.

## Client → Pharmacie

1. Le Client sélectionne MTN ou Orange dans l'espace Client.
2. NAXA affiche nom, numéro et code marchand à six chiffres ainsi que le montant.
3. MTN : préparation *126*4*<code 6 chiffres>*<montant>#.
4. Orange : préparation #150*47# ; les étapes et le montant doivent être confirmés chez l'opérateur sur SIM réelle.
5. Android ouvre le composeur ; le Client confirme la commande puis saisit son PIN chez l'opérateur.
6. Le Client partage le SMS de débit avec NAXA. Aucun lecteur de notification ou accès SMS en arrière-plan n'est demandé.

## Client / Promoteur payeur

Le Client partage le SMS de débit depuis son téléphone ; le Promoteur fait de même pour son abonnement NAXA. Le partage volontaire transmet le texte à l'analyse structurée, mais ne certifie pas à lui seul son origine ni la transaction. Le Client et le Promoteur n'obtiennent jamais RECEIVE_SMS en arrière-plan.

## Pharmacie / Partenaire bénéficiaire

La variante Professionnelle peut recevoir les SMS entrants directement sur le téléphone marchand après deux autorisations séparées : consentement explicite dans NAXA et permission Android RECEIVE_SMS. La collecte locale ne retient que les expéditeurs exacts OrangeMoney et MobileMoney afin de sélectionner les messages de paiement.

Le libellé expéditeur n'est pas une preuve de paiement. Le téléphone transmet le SMS reçu au nouvel endpoint /api/paiements/android-sms ; le serveur extrait les champs utiles, conserve une empreinte SHA-256 et les données structurées, jamais le texte brut. L'événement reste en attente de rapprochement et ne confirme rien seul.

Le SMS de débit Client/Promoteur et le SMS de crédit reçu par la Pharmacie/Partenaire peuvent provenir de deux téléphones différents. Le moteur cible les rapproche principalement par ID de transaction, puis vérifie le canal, le sens débit/crédit, le montant, les numéros et l'heure. Seule une paire cohérente et unique peut confirmer la transaction ; absence de SMS, doublon, écart ou ambiguïté restent en attente / revue manuelle.

## Abonnement Partenaire

Le compagnon enrôle les partenaires actifs où le compte possède un rôle owner ou manager. Les SMS de crédit reçus sur le téléphone bénéficiaire peuvent entrer dans le flux générique de collecte via /api/paiements/android-sms. Le cycle de facturation Partenaire (tarif, intention, règlement et activation) n'existe pas encore dans le produit : aucune paire de SMS ne doit donc activer un abonnement Partenaire tant que ce modèle métier n'est pas défini.

## Administrateur

La variante Admin permet trois chemins distincts :
1. SMS_RECEIVED Android : l'adresse d'origine brute sert uniquement à filtrer OrangeMoney ou MobileMoney. Elle ne prouve pas le paiement. La confirmation repose sur le rapprochement du SMS de débit Promoteur et du SMS de crédit NAXA, avec l'ID de transaction comme clé commune.
2. NotificationListener : candidat de revue manuelle, jamais une capture d'origine authentifiée.
3. Partage manuel : revue manuelle, jamais auto-confirmation.

RECEIVE_SMS est déclaré uniquement dans les manifestes Professionnel et Admin. Le service de notifications reste lui aussi limité aux variantes Professionnelle et Admin ; les gates runtime interdisent Client et Promoteur.

## Configuration technique

- Android Gradle Plugin 9.4.0 ; Gradle CI 9.6.0 ; JDK 17.
- compileSdk 36 ; targetSdk 36 ; minSdk 26.
- Tests unitaires couvrant le blocage Client et les identifiants exacts.
- Les APK Debug de CI ne sont pas des APK Release signés destinés à la distribution.

## Endpoints

- Promoteur : /api/promoteur/paiements/device/register, /api/promoteur/paiements/intent, /api/promoteur/paiements/share, /api/promoteur/paiements/notification-candidate.
- Partenaire : /api/partenaire/paiements/device/register, /api/partenaire/paiements/notification-candidate.
- Collecte SMS bénéficiaire : /api/paiements/android-device/sms-consent, /api/paiements/android-sms.
- Client : /api/client/paiements/livraison/pending, /api/client/paiements/livraison/share.
- Admin capture authentifiée : /api/admin/paiements/device/register, /api/admin/paiements/capture.
- Admin secours et notifications candidates : /api/admin/paiements/share.

Les nouveaux chemins de collecte ne conservent pas le corps SMS brut et ne confirment pas un paiement à partir d'un seul message. Le rapprochement par référence commune reste à implémenter. Les essais opérateur et téléphones réels restent obligatoires.


## Séparation des accès Android (13 novembre 2026)

Trois APK sont produites : Standard (Client + Promoteur), Professionnelle (Pharmacie + Partenaire) et Admin. Le service `NaxaNotificationListenerService` et le récepteur système `SmsReceiver` sont déclarés seulement dans les manifestes Professionnel et Admin. L'APK Standard ne contient ni lecteur de notifications ni RECEIVE_SMS.

Le lecteur de notifications exige le consentement explicite dans NAXA et l'accès spécial Android. Le récepteur SMS exige un consentement distinct dans NAXA et la permission Android RECEIVE_SMS. Le filtre SMS exact OrangeMoney / MobileMoney sert uniquement à sélectionner le flux à traiter, jamais à authentifier le paiement. Les événements sont stockés sous provenance `sms_receiver`, sans corps brut, et restent en attente de la paire de preuves. Une seule réception ne confirme jamais une transaction.

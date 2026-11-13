# NAXA Paiement Android — distribution privée

La référence métier est l'architecture des paiements dans ../../docs/ARCHITECTURE_PAIEMENT_PILOTE.md.

## Variantes APK privées — sans Play Store

| Variante | Profils | Permissions / accès |
|---|---|---|
| Standard cm.naxa.paymentcompanion | Client, Promoteur/Pharmacie, Partenaire | Pas de RECEIVE_SMS. Accès spécial aux notifications facultatif pour Promoteur et Partenaire uniquement. Client explicitement bloqué. |
| Admin cm.naxa.paymentcompanion.admin | Administrateur | RECEIVE_SMS avec consentement et autorisation Android ; lecteur de notifications facultatif après consentement. |

L'installation se fait par APK depuis le canal officiel NAXA. Android peut demander d'autoriser cette source à installer des applications ; NAXA ne contourne pas cet avertissement.

La variante Admin demande séparément RECEIVE_SMS après consentement. Android classe cette permission comme dangereuse et hard-restricted : l'installateur doit l'autoriser dans l'allowlist des permissions restreintes. Le simple téléchargement APK, le transfert Bluetooth ou le réglage « installer des applications inconnues » ne garantissent pas cette allowlist. Tester les installateurs et téléphones cibles ; ne jamais désactiver Play Protect ni contourner Android. Si l'autorisation est refusée, le partage volontaire du SMS Admin ou la vérification manuelle restent disponibles.

## Règles de lecture des notifications

Android accorde au lecteur un accès technique au flux général des notifications du téléphone. L'utilisateur doit activer cet accès spécial dans les paramètres Android après avoir donné son consentement dans NAXA.

Le service :
- refuse toujours le profil Client ;
- n'agit que pour les rôles promoteur, partenaire et admin, avec consentement ;
- filtre localement les seuls titres exacts OrangeMoney et MobileMoney ;
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

## Promoteur / Pharmacie

Le Promoteur prépare une intention d'abonnement liée à son appareil. Il peut partager son SMS de débit ou activer la détection des notifications. Une notification candidate ne clôt pas l'intention et ne compte pas comme preuve payer-SMS de niveau 1 ; le SMS volontairement partagé reste requis pour le rapprochement automatique existant.

## Partenaire

Le compagnon enrôle les partenaires actifs où le compte possède un rôle owner ou manager. Le lecteur de notifications et le partage volontaire transmettent les données extraites à la revue manuelle. Le cycle de facturation Partenaire (tarif, intention, règlement et activation) n'existe pas encore dans le produit : aucune notification ou SMS ne peut donc activer un abonnement Partenaire.

## Administrateur

La variante Admin permet trois chemins distincts :
1. SMS_RECEIVED Android : vraie adresse d'origine disponible, expéditeur exact OrangeMoney ou MobileMoney, contrôles côté serveur ; c'est le seul chemin pouvant participer à la double preuve d'auto-confirmation Promoteur.
2. NotificationListener : candidat de revue manuelle, jamais une capture d'origine authentifiée.
3. Partage manuel : revue manuelle, jamais auto-confirmation.

RECEIVE_SMS demeure uniquement dans src/admin/AndroidManifest.xml. Le service de notifications est dans le manifeste commun mais son gate runtime interdit le Client.

## Configuration technique

- Android Gradle Plugin 9.4.0 ; Gradle CI 9.6.0 ; JDK 17.
- compileSdk 36 ; targetSdk 36 ; minSdk 26.
- Tests unitaires couvrant le blocage Client et les identifiants exacts.
- Les APK Debug de CI ne sont pas des APK Release signés destinés à la distribution.

## Endpoints

- Promoteur : /api/promoteur/paiements/device/register, /api/promoteur/paiements/intent, /api/promoteur/paiements/share, /api/promoteur/paiements/notification-candidate.
- Partenaire : /api/partenaire/paiements/device/register, /api/partenaire/paiements/notification-candidate.
- Client : /api/client/paiements/livraison/pending, /api/client/paiements/livraison/share.
- Admin capture authentifiée : /api/admin/paiements/device/register, /api/admin/paiements/capture.
- Admin secours et notifications candidates : /api/admin/paiements/share.

Les nouveaux chemins de candidature ne conservent pas le corps SMS brut et ne font aucune activation. Les essais opérateur et téléphones réels restent obligatoires.


## Séparation du lecteur Android (13 novembre 2026)

Trois APK sont produites : Standard (Client + Promoteur), Professionnelle (Pharmacie + Partenaire) et Admin. Le service `NaxaNotificationListenerService` a été retiré du manifeste commun : il est déclaré seulement dans les manifestes Professionnel et Admin. L'APK Standard ne contient donc pas le lecteur et n'affiche pas de contrôle d'accès aux notifications.

Le lecteur Professionnel/Admin exige le consentement explicite dans NAXA et l'accès spécial Android. Le filtre local n'accepte que les paquets MTN MoMo / Orange Money listés dans `PaymentNotificationSourceClassifier`. La capture SMS système RECEIVE_SMS reste réservée à Admin et garde son consentement distinct. Toute notification/SMS collecté est conservé en revue manuelle ; le texte brut n'est pas persisté et aucune activation d'abonnement ne se fait depuis le seul événement.

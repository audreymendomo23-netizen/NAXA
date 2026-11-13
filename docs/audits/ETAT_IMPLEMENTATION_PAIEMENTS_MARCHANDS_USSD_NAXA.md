# NAXA — état de développement des paiements marchands, USSD et notifications

Date : 13 novembre 2026  
Branche cible : main  
Statut : PARTIEL — code intégré, recette Android réelle et facturation Partenaire incomplètes.

## Présent sur main

### Configuration marchande
- naxa_merchant_payment_destinations sépare MTN et Orange par pharmacie ou partenaire.
- Nom du bénéficiaire, numéro marchand et code exactement à six chiffres.
- Journal d'audit de création / mise à jour.
- Écrans de configuration dans /pharmacie/promoteur/paiements et /partenaire/paiements, limités aux gestionnaires autorisés.
- Le RPC d'écriture et les tables restent réservés au serveur service_role.

### Client et USSD
- Le Client récupère les coordonnées actives de la pharmacie liée à sa réservation.
- L'écran affiche bénéficiaire, téléphone, code marchand et montant.
- Android ouvre le composeur avec MTN *126*4*<code six chiffres>*<montant># ou Orange #150*47#.
- Le Client confirme lui-même la commande et entre son code secret uniquement chez l'opérateur.
- Le Client ne dispose d'aucun lecteur de notifications ni de permission READ_SMS / RECEIVE_SMS.
- Le Client partage volontairement le SMS après débit ; le texte partagé ne fournit pas nécessairement une origine SMS authentifiée.

### Promoteur / Pharmacie
- Enrôlement Android Promoteur et intention d'abonnement existants.
- Nouveau lecteur de notifications facultatif, limité par un gate à Promoteur, Partenaire et Admin ; le profil Client est rejeté.
- Les notifications Promoteur sont reliées à une intention et sauvegardées dans une table candidate en revue manuelle, sans clôturer l'intention ni créer le niveau 1 de preuve.
- Le partage volontaire du SMS conserve le circuit payer-SMS existant.
- Le SMS reçu par Admin via SMS_RECEIVED reste nécessaire pour la double preuve automatique.

### Partenaire
- Enrôlement des appareils des partenaires actifs où l'utilisateur est propriétaire ou gestionnaire.
- Notification candidate et partage volontaire transmis au serveur.
- Table de candidats protégée par RLS, sans accès direct client et sans stockage du texte brut.
- Cycle d'abonnement Partenaire non existant : aucun tarif, aucune intention et aucune règle d'activation n'ont été introduits. Tous les candidats sont en revue manuelle ; pas d'activation automatique.

### Admin
- Le récepteur Admin SMS_RECEIVED reste le seul chemin qui dispose de l'adresse d'origine brute Android et qui peut entrer dans la vérification automatique existante.
- Identifiants stricts : OrangeMoney et MobileMoney (comparaison exacte côté Android et API).
- La lecture des notifications Admin et le partage manuel passent en revue manuelle ; ils ne sont pas transmis comme expéditeur authentifié.
- RECEIVE_SMS reste déclarée uniquement dans le manifeste de la variante Admin.

## Migrations ajoutées dans ce lot

- 20261113180000_partner_payment_notification_capture.sql : appareils Partenaire + candidats de notification / partage.
- 20261113180500_promoteur_payment_notification_candidates.sql : candidats notification Promoteur reliés à une intention active.
- Les deux tables utilisent RLS, révoquent les accès directs anon/authenticated et n'accordent l'accès qu'à service_role.

## Limites / preuves encore requises

- Appliquer les migrations uniquement sur Supabase Replay et vérifier les ACL/RLS.
- Compiler et tester les variantes Android Standard/Admin.
- Vérifier sur téléphones réels le filtrage des notifications sur Samsung, Tecno, Infinix et autres appareils.
- Tester les SIM Orange et MTN, les codes USSD, double SIM et le flux après retour du composeur.
- Vérifier les notifications tronquées, les doublons, la révocation du consentement, et l'absence de transmission de notifications non pertinentes.
- Confirmer avec Orange le parcours complet après #150*47# ; le préremplissage du montant n'est pas affirmé.
- Construire le cycle de facturation Partenaire avant toute auto-confirmation ou activation d'abonnement.
- Créer des APK Release signés et tester la distribution APK privée.

Aucune migration Supabase Production, aucun déploiement Vercel Production et aucune déclaration AU VERT ne sont couverts par ce lot.

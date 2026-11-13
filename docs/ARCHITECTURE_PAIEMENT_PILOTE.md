# NAXA — architecture des paiements mobiles

Mise à jour : 13 novembre 2026 — décision métier consolidée et premier lot de code Android.

## Principes communs

1. L'application Client ne lit jamais les notifications ou les SMS en arrière-plan. Le Client partage volontairement le SMS de débit.
2. La lecture des notifications est réservée aux profils Pharmacie/Promoteur, Partenaire et Administrateur, après consentement NAXA et activation de l'accès spécial Android.
3. L'accès Android aux notifications expose techniquement un flux large. NAXA filtre localement les titres exacts OrangeMoney et MobileMoney, n'envoie que les notifications reconnues et ne stocke pas le contenu brut.
4. Un titre de notification n'est pas une métadonnée d'origine SMS authentifiée. Une notification détectée est un indice à rapprocher, toujours en revue manuelle ; elle ne peut pas déclencher seule une confirmation.
5. Le récepteur SMS_RECEIVED et l'adresse d'origine fournie par Android sont réservés à la variante Admin. Seuls les identifiants stricts OrangeMoney et MobileMoney sont acceptés pour le circuit automatique Admin.
6. Les codes secrets, PIN et OTP Mobile Money ne sont jamais demandés, lus, transmis ou enregistrés par NAXA.
7. Aucun paiement n'est confirmé à partir de la seule génération USSD, de l'ouverture du composeur, d'un champ saisi ou d'une notification non rapprochée.

## A. Client → Pharmacie

- Le Client choisit MTN Mobile Money ou Orange Money.
- NAXA présente le nom du bénéficiaire, son numéro, son code marchand à six chiffres et le montant dû.
- Sur Android, NAXA ouvre le composeur natif avec la commande préparée :
  - MTN : *126*4*<code marchand 6 chiffres>*<montant>#.
  - Orange : #150*47#. Le préremplissage du montant Orange n'est pas présumé ; il doit être confirmé par une documentation opérateur ou un essai réel.
- Le Client confirme lui-même la commande et saisit son PIN uniquement dans l'interface de l'opérateur.
- Après le débit, le Client partage volontairement son SMS avec NAXA. Le partage Android peut ne fournir que le texte ; si l'origine n'est pas transmise par une source système fiable, NAXA ne la considère pas authentifiée.
- La Pharmacie vérifie le crédit réel et confirme dans sa Caisse. Le SMS partagé par le Client n'est pas un encaissement.

Interdictions côté Client : pas de lecteur de notifications, pas de READ_SMS, pas de RECEIVE_SMS.

## B. Abonnement Pharmacie payé par le Promoteur

Dans le modèle actuel, l'abonnement pharmacie est payé depuis l'espace Promoteur. Le compagnon Standard peut :
- préparer une intention d'abonnement sur le téléphone enrôlé ;
- recevoir une notification candidate si l'accès spécial Android a été activé ;
- transmettre le SMS de débit volontairement.

La notification candidate est reliée à l'intention et conservée en revue manuelle. Elle ne clôt pas l'intention et ne constitue pas la preuve de débit de niveau 1. Le partage volontaire du SMS et la preuve de crédit Admin demeurent nécessaires pour le circuit actuel d'auto-confirmation à double preuve.

## C. Abonnement Partenaire

Le compagnon Standard peut enrôler les établissements pour lesquels l'utilisateur est propriétaire ou gestionnaire et transmettre les notifications candidates ou les SMS partagés. Le serveur conserve les champs extraits, l'empreinte du message et la source, sans enregistrer le SMS brut.

Limite du modèle actuel : le dépôt ne dispose pas encore d'un cycle de facturation Partenaire complet (tarif, intention, échéance, règlement et règle de réactivation). Les éléments reçus sont donc placés en revue manuelle et ne déclenchent aucune activation ou prolongation d'abonnement. Ce raccordement métier reste à construire.

## D. Administrateur NAXA

La variante Admin accepte :
- lecture facultative des notifications comme candidats de revue manuelle ;
- récepteur Android SMS_RECEIVED, avec consentement NAXA et autorisation Android RECEIVE_SMS ;
- partage manuel d'un SMS ;
- contrôle du rapprochement et décision manuelle.

Le circuit automatique existant reste réservé au vrai SMS reçu par le récepteur Admin, avec adresse d'origine brute exacte, destination NAXA figée, montant, canal, payeur, référence, heure et preuve de débit Promoteur de niveau 1. Une notification Android n'est jamais envoyée à l'endpoint de capture authentifiée.

## E. Confidentialité et sécurité Android

- L'accès spécial aux notifications est demandé uniquement aux rôles autorisés et doit pouvoir être révoqué.
- Le profil Client est explicitement exclu côté interface et côté service Android, même si un ancien consentement subsiste sur le téléphone.
- RECEIVE_SMS reste déclarée uniquement dans le manifeste de la variante Admin.
- Le lecteur local ne traite que les notifications dont le titre est exactement OrangeMoney ou MobileMoney ; les autres notifications sont ignorées.
- Les données de paiement candidates sont structurées et l'empreinte SHA-256 est conservée ; le texte intégral n'est pas persisté.
- Les erreurs, doublons, incohérences, preuves absentes et refus d'autorisation mènent à une revue manuelle.

## F. Distribution et recette

La distribution reste privée par APK depuis le canal officiel NAXA, sans Play Store. L'avertissement Android sur l'installation depuis une source inconnue est accepté et doit être expliqué dans le guide d'installation.

La recette doit couvrir de vrais téléphones Android et des SIM MTN/Orange, notamment le composeur USSD, double SIM, notifications, révocation de l'accès, titres d'expéditeur, messages tronqués, doublons et latence opérateur. Les essais simulés ne remplacent pas ces preuves.

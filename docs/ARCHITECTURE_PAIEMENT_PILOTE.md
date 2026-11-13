# NAXA — architecture de paiement : USSD, preuves SMS et notifications Android

**Version de développement — 13 novembre 2026.** Ce document décrit la cible métier et distingue le code déjà présent des points restant à valider.

## Règles selon le profil

| Profil Android | Lecteur de notifications | Partage volontaire SMS | Réception SMS système |
|---|---|---|---|
| Client / Standard | Interdit | Oui, SMS de débit | Non |
| Promoteur / Standard | Non | Oui, SMS de débit | Non |
| Pharmacie / Professionnel | Oui, facultatif après consentement | Oui | Non |
| Partenaire / Professionnel | Oui, facultatif après consentement | Oui | Non |
| Administrateur / Admin | Oui, facultatif après consentement | Oui | Oui, consentement et permission distincts |

Le Client ne doit pas recevoir une demande d'accès aux notifications. Le Promoteur reste sans lecteur de notifications selon la dernière règle métier.

## Configuration marchande par entité

Chaque Pharmacie et Partenaire configure ses coordonnées séparément pour MTN et Orange : nom de bénéficiaire, numéro marchand, code marchand exact de 6 chiffres et activation du canal. Les zéros de tête sont conservés. Une entité ne peut pas lire ni modifier la configuration d'une autre. Les coordonnées globales de paiement NAXA sont exclusivement réservées aux règlements dus à NAXA.

## Parcours USSD Client Android

MTN : NAXA construit `*126*4*CODEMARCHAND*MONTANT#`, sans espace, avec code marchand de 6 chiffres et montant provenant de l'intention de paiement. Orange : NAXA ouvre `#150*47#`. Le parcours de saisie suivant Orange, y compris le préremplissage du bénéficiaire et du montant, doit être confirmé sur SIM réelle ou par documentation opérateur ; ne pas inventer de syntaxe.

NAXA ouvre le composeur natif. Le Client vérifie le destinataire, valide lui-même l'appel / USSD et saisit le code secret uniquement dans l'interface de l'opérateur. NAXA ne reçoit, ne demande, ne lit et ne stocke jamais le code secret. L'ouverture du composeur ou le retour de l'USSD n'est jamais une preuve de paiement.

## Distribution Android hors Play Store

Distribution directe des APK par le site / canal officiel NAXA, sans Play Store. L'avertissement Android d'installation depuis une source inconnue est accepté. Trois variantes sont prévues :
- Standard : Client et Promoteur. Aucun service NotificationListener dans le manifeste fusionné ; pas de RECEIVE_SMS.
- Professionnel : Pharmacie et Partenaire. NotificationListener uniquement, aucun RECEIVE_SMS.
- Admin : NotificationListener et RECEIVE_SMS, deux mécanismes à consentement distinct.

Le service NotificationListener est déclaré seulement dans les manifestes Professionnel et Admin. L'accès Android aux notifications reste techniquement large : le filtrage local réduit ce qui est traité/transmis mais ne réduit pas le périmètre technique de l'autorisation accordée par Android. Le lecteur filtre les paquets MTN/Orange reconnus. L'utilisateur peut retirer le consentement NAXA et l'accès Android séparément.

## Collecte et preuve

Le Client partage lui-même son SMS. Android `ACTION_SEND` ne fournit généralement que le texte, pas l'identifiant système d'origine du SMS ; le texte ne peut donc pas prouver l'émetteur à lui seul. L'identifiant exact `OrangeMoney` / `MobileMoney` n'est fiable que si reçu d'une vraie métadonnée système, comme un SMS capturé par le récepteur Admin avec permission.

Les applications Pharmacie / Partenaire / Admin peuvent lire les notifications pertinentes après activation volontaire. Les champs extraits, le paquet source, le type de mouvement, le montant, la référence, les numéros partiellement masqués, la date et une empreinte SHA-256 sont conservés. Le texte brut SMS/notification ne doit pas persister.

Tous les éléments entrent en rapprochement non confirmé. Une preuve extraite, un succès déclaré ou une notification seule ne confirme jamais un paiement. Le moteur doit comparer l'intention : canal, montant, payeur, bénéficiaire, référence unique, date et direction débit/crédit. Les anomalies, doublons, ambiguïtés et sources non authentifiées vont en revue manuelle.

## Processus métier

### Client → Pharmacie
Le Client partage la preuve de débit. La pharmacie rapproche avec le crédit réellement reçu dans son compte marchand et valide dans la Caisse. Le paiement est marqué payé seulement après vérification du règlement reçu.

### Promoteur → NAXA
Le Promoteur partage le SMS de débit. L'Admin reçoit le crédit par capture SMS de son téléphone, notification ou partage, puis confronte les deux preuves. Le mécanisme actuel de double preuve reste obligatoire.

### Pharmacie / Partenaire → NAXA
Les notifications et SMS partagés sont collectés pour le rapprochement des abonnements. Les abonnements Pharmacie ont un modèle existant ; il reste à raccorder le registre commun à leurs intentions réelles d'abonnement. Le schéma Replay consulté n'a pas de modèle d'abonnement/tarif Partenaire : aucun montant ni renouvellement Partenaire ne doit être inventé avant définition métier.

## Formulaire universel

Le montant attendu et la date/heure courante sont générés depuis l'intention et le fuseau Africa/Douala. Quand le SMS est partagé, les champs réellement extraits remplacent les valeurs générées et leur provenance est indiquée. Sans SMS, les valeurs générées restent modifiables avant transmission. Distinguer toujours valeur générée, saisie manuelle, champ extrait et champ vérifié indépendamment.

## Sécurité et audit

- Authentifier le compte NAXA, le profil actif, l'appartenance à l'entité et le jeton d'appareil à chaque appel.
- Consentement NAXA et accès spécial Android sont deux conditions obligatoires de lecture.
- Ne jamais persister les SMS/notifications bruts, codes PIN ou secrets.
- Conserver les empreintes anti-doublon et les données structurées strictement nécessaires.
- Utiliser RLS et des droits service-role uniquement pour les tables techniques.
- Les nouvelles collectes restent `manual_review` jusqu'à rapprochement et décision métier.
- Ne pas déployer en Production ni appliquer une migration Production pendant ce chantier.

## Recette obligatoire

- Manifeste fusionné Standard : pas de NotificationListener / RECEIVE_SMS.
- Professionnel : NotificationListener présent, RECEIVE_SMS absent.
- Admin : NotificationListener et RECEIVE_SMS présents.
- Tests unitaires des rôles, des paquets source, du consentement et des refus.
- Tests de révocation et d'accès refusé au serveur.
- Tests de codes marchands 5, 6 et 7 chiffres, zéros initiaux, séparation des entités.
- Tests de partage SMS tronqué, émetteur non vérifiable, doublons, mauvais montant/canal.
- E2E sur vrais téléphones Android, SIM MTN et Orange, SIM double, tests USSD et notifications réelles.
- Aucun état AU VERT avant les preuves de ces tests réels.

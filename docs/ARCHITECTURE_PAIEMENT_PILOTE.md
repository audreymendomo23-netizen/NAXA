# NAXA — architecture de paiement : USSD, preuves SMS et notifications Android

**Version de développement — 13 novembre 2026.** Ce document décrit la cible métier et distingue le code déjà présent des points restant à valider.

## Règles selon le profil

| Profil Android | Lecteur de notifications | Partage volontaire SMS | Réception SMS système |
|---|---|---|---|
| Client / Standard | Interdit | Oui, SMS de débit | Non |
| Promoteur / Standard | Interdit | Oui, SMS de débit | Non |
| Pharmacie / Professionnel | Oui, facultatif après consentement | Oui | Oui, consentement et permission distincts |
| Partenaire / Professionnel | Oui, facultatif après consentement | Oui | Oui, consentement et permission distincts |
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
- Professionnel : Pharmacie et Partenaire. NotificationListener et RECEIVE_SMS ; deux autorisations à consentement distinct.
- Admin : NotificationListener et RECEIVE_SMS ; deux autorisations à consentement distinct.

Le service NotificationListener est déclaré seulement dans les manifestes Professionnel et Admin. L'accès Android aux notifications reste techniquement large : le filtrage local réduit ce qui est traité/transmis mais ne réduit pas le périmètre technique de l'autorisation accordée par Android. Le lecteur filtre les paquets MTN/Orange reconnus. L'utilisateur peut retirer le consentement NAXA et l'accès Android séparément.

## Collecte et preuve

Le Client partage lui-même son SMS de débit. Android `ACTION_SEND` fournit le contenu partagé, sans métadonnée système fiable de l'expéditeur ; cela n'empêche pas son utilisation comme élément de rapprochement. La Pharmacie ou le Partenaire peut recevoir le SMS de crédit directement sur son téléphone marchand via `SmsReceiver`, après consentement explicite NAXA et permission Android RECEIVE_SMS. L'Admin conserve son mécanisme de réception SMS pour les règlements dus à NAXA.

L'identifiant brut `OrangeMoney` / `MobileMoney` sert uniquement à sélectionner les SMS à collecter sur le téléphone bénéficiaire. Il ne certifie ni l'origine financière ni le succès du paiement. La confirmation repose sur le croisement indépendant du SMS de débit et du SMS de crédit, notamment leur ID de transaction commun. Les deux SMS peuvent être collectés sur des téléphones différents.

Le système conserve uniquement les champs structurés nécessaires (direction débit/crédit, canal, montant, ID de transaction, date, numéros partiellement masqués, libellé marchand), la provenance et une empreinte SHA-256. Le corps brut SMS/notification ne doit pas persister.

Un SMS seul, un succès déclaré ou une notification ne confirme jamais un paiement. Le moteur de rapprochement doit d'abord retrouver un ID de transaction commun, puis contrôler le canal, les directions opposées, le montant, le payeur, le bénéficiaire et la cohérence temporelle. Une paire cohérente, unique et non déjà consommée peut confirmer la transaction. SMS manquant, ID absent, écart, doublon ou ambiguïté restent en attente / revue manuelle ; l'absence de SMS dans NAXA ne signifie pas que l'opérateur n'a pas exécuté le paiement.

## Processus métier

### Client → Pharmacie
Le Client partage le SMS de débit. Le téléphone Pharmacie collecte le SMS de crédit reçu sur le compte marchand. NAXA rapproche les deux SMS par ID de transaction et contrôles de cohérence. La paire unique et cohérente confirme le paiement et met à jour la Caisse ; en cas de donnée manquante ou d'écart, le dossier reste en attente / revue manuelle.

### Promoteur → NAXA
Le Promoteur partage le SMS de débit. L'Admin reçoit le SMS de crédit NAXA sur son téléphone. Le rapprochement se fonde sur l'ID de transaction commun et les autres champs de cohérence ; le libellé expéditeur ne sert qu'au filtrage de collecte.

### Pharmacie / Partenaire → NAXA
Le téléphone Partenaire peut recevoir le SMS de crédit du compte marchand et le croiser avec le SMS de débit transmis par le payeur. Les abonnements Pharmacie ont un modèle existant ; il reste à raccorder le registre commun à leurs intentions réelles d'abonnement. Le schéma Replay consulté n'a pas de modèle d'abonnement/tarif Partenaire : aucun montant ni renouvellement Partenaire ne doit être inventé avant définition métier.

## Formulaire universel

Le montant attendu et la date/heure courante sont générés depuis l'intention et le fuseau Africa/Douala. Quand le SMS est partagé, les champs réellement extraits remplacent les valeurs générées et leur provenance est indiquée. Sans SMS, les valeurs générées restent modifiables avant transmission. Distinguer toujours valeur générée, saisie manuelle, champ extrait et champ vérifié indépendamment.

## Sécurité et audit

- Authentifier le compte NAXA, le profil actif, l'appartenance à l'entité et le jeton d'appareil à chaque appel.
- Consentement NAXA et permission Android RECEIVE_SMS sont deux conditions obligatoires pour la réception SMS ; le consentement NotificationListener et l'accès spécial Android restent distincts.
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
- Tests de partage SMS tronqué, SMS reçu manquant, ID commun, ID différent, doublons, réutilisation d'un ID, mauvais montant/canal.
- Vérifier sur chaque installateur / appareil Android que RECEIVE_SMS est effectivement allowlistée et accordée ; cette permission est classée hard-restricted par Android.
- E2E sur vrais téléphones Android, SIM MTN et Orange, SIM double, tests USSD et notifications réelles.
- Aucun état AU VERT avant les preuves de ces tests réels.

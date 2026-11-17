# Audit — inscriptions, invitations et échéances des partenaires NAXA

**Date :** 17 novembre 2026  
**Périmètre :** audit du code `main` et lecture seule du projet Supabase Replay `pwfftcsjyeibxxqhwysw`.  
**État :** décision métier enregistrée ; extension technique non implémentée ; aucun déploiement Production.

## Décisions validées

### Univers inclus

Le mécanisme commun couvre exclusivement les univers professionnels explicitement gérés par NAXA :

1. **Pharmacie** — Promoteurs et collaborateurs de pharmacie.
2. **Parapharmacie** — Partenaires de type `parapharmacie` et leurs collaborateurs.
3. **Examens médicaux** — Centres de type `centre_examen` et leurs collaborateurs.
4. **Prestations à domicile** — Partenaires de type `professionnel_domicile` et leurs collaborateurs.

Aucun univers supplémentaire ne doit être déduit d'une catégorie générique ou d'une valeur technique.

### Univers et suppléments exclus

- Aide ;
- Dispositifs connectés / dispositifs médicaux ;
- Bébé & Maman / maternité ;
- toute valeur générique `autre` non explicitement validée comme univers partenaire NAXA ;
- tout centre médical distinct qui ne figure pas dans les univers explicitement gérés.

### Calendrier périodique

Choix validé : **cycle mensuel commun avec rappel à J-5**.

Décision complémentaire validée le 17 novembre 2026 : **dans chacun des quatre univers (Pharmacie, Parapharmacie, Examens médicaux, Prestations à domicile), le cycle mensuel commence exclusivement à la confirmation effective du premier paiement par NAXA**. La validation du dossier, la création du partenaire, la saisie d'un montant, la déclaration d'un paiement ou la réception isolée d'une notification ne déclenchent pas le cycle. La date de confirmation vérifiée est la référence de début de période ; le rappel J-5 est calculé sur l'échéance réelle issue de cette période.

Cette règle harmonise le calendrier des échéances qui existent réellement. Elle ne crée pas automatiquement un abonnement mensuel, une redevance ou une obligation financière pour un partenaire dont le modèle métier ne le prévoit pas. Les dates et conditions de référence restent celles des contrats, abonnements ou conventions propres à chaque univers.

## Audit technique — constats vérifiés

### Worker périodique

Le worker `src/app/api/cron/validite/route.ts` appelle actuellement uniquement `public.synchroniser_validite_pharmacies()`, puis réclame la file `claim_notification_email_outbox`. Il ne déclenche pas de synchronisation générique des échéances partenaires.

### Synchronisation actuelle

Dans Replay, `public.synchroniser_validite_pharmacies()` :
- met à jour les abonnements Promoteur échus ;
- expire les conventions Promoteur ;
- peut désactiver les pharmacies concernées ;
- crée/actualise les verrous d'accès Promoteur.

Cette fonction ne traite pas les échéances des partenaires Parapharmacie, Examens médicaux ou Prestations à domicile.

### Rappels J-5 existants

Replay expose deux fonctions distinctes :
- `claim_validite_rappels_5j()` pour les abonnements des pharmacies ;
- `claim_validite_promoteurs_5j()` pour les abonnements Promoteur.

Leur logique s'appuie sur les tables d'abonnement existantes. Aucun moteur J-5 commun couvrant les quatre univers n'a été identifié.

### E-mails

La migration `20261102105229_notification_email_outbox_delivery.sql` limite actuellement l'enqueue e-mail à six types de notifications liés aux abonnements Promoteur/Admin et à leurs règlements. Les invitations et échéances des autres univers ne sont donc pas intégrées à cette allowlist.

### Invitations

Des mécanismes spécialisés existent déjà, notamment :
- invitations du personnel des centres d'examens (`exam_staff_invites`), avec expiration propre de l'invitation ;
- invitations Livreur rattachées au parcours Pharmacie.

Ces flux spécialisés ne constituent pas encore une passerelle d'invitation et de notification commune à tous les partenaires. Il faut préserver leurs contrôles d'acceptation, d'identité, d'affectation et de révocation.

### Prestations à domicile

Le modèle comporte des conventions indépendantes (`partner_independent_agreements`) avec une date `expires_at` facultative. Leur expiration doit être suivie comme une échéance de convention ; elle ne doit pas être confondue avec un abonnement mensuel.

## Architecture cible à implémenter

1. Conserver les sources métier de chaque univers comme sources de vérité.
2. Ajouter une orchestration commune qui détecte les échéances réelles, prépare les rappels J-5 et déclenche les traitements d'expiration uniquement selon les règles de chaque source.
3. Faire passer les notifications e-mail et les invitations par une file commune idempotente, avec reprise, statut, journal et anti-doublon.
4. Garder les parcours d'acceptation d'invitation spécialisés lorsqu'ils portent des règles différentes ; mutualiser la délivrance et le suivi, pas les autorisations.
5. Définir les destinataires selon les rôles et affectations actifs de chaque univers. Ne jamais envoyer une échéance d'établissement à tous ses collaborateurs sans règle métier.
6. Utiliser le fuseau métier du Cameroun pour les dates calendaires et les rappels.
7. Ne pas créer de fausses échéances lorsqu'une source métier ne prévoit ni abonnement ni convention périodique.

## Preuves et limites de cette passe

- Lecture du worker Next.js sur `main`.
- Lecture des migrations relatives à l'outbox e-mail, aux conventions indépendantes, aux invitations Examens et aux rappels Prestations.
- Lecture seule de Replay : définitions SQL des fonctions de validité et de rappel, schéma des tables concernées et jobs `pg_cron`.
- Aucun secret n'a été lu ni modifié.
- Aucune écriture Supabase, migration appliquée, modification de code, exécution de test fonctionnel ou déploiement n'a été effectué pendant cet audit.

**Verdict : PARTIEL — décision et diagnostic documentés ; implémentation commune et preuves E2E restent à réaliser.**


## Contrôle complémentaire avant implémentation — 17 novembre 2026

Une seconde lecture du schéma Replay a recherché toutes les colonnes de dates d'échéance (echeance, expires_at, date_expiration, due_at, period_end) et les tables de paiement/abonnement liées aux partenaires.

### Blocage confirmé : échéances mensuelles partenaires

- admin_partner_dossiers contient monthly_fee_fcfa, mais aucune date d'échéance, date de début de période, dernière date de paiement ou statut d'abonnement.
- Les seules tables de cycle mensuel avec echeance observées sont abonnements et abonnements_promoteurs, rattachées au parcours Pharmacie/Promoteur.
- partner_independent_agreements.expires_at existe pour les conventions indépendantes Prestations à domicile, mais cette date est facultative et représente une fin de convention, pas une échéance de facturation mensuelle.
- Aucune table de souscription périodique partenaire distincte pour Parapharmacie et Examens n'a été trouvée dans l'inventaire interrogé.
- Les intentions de paiement génériques repérées sont liées à des transactions/réservations ou à des captures de notifications ; elles ne fournissent pas à elles seules un calendrier d'abonnement mensuel partenaire.

**Conséquence :** le choix métier « mensuel + J-5 » est validé, mais son application aux trois univers partenaires hors Pharmacie exige d'abord une source de vérité de facturation : début de période, prochaine échéance, statut, paiement confirmé et règle de renouvellement. Le montant mensuel du dossier ne suffit pas à calculer une échéance ni à prouver un paiement.

### Blocage confirmé : invitation e-mail unifiée

- exam_staff_invites contient une adresse e-mail, un token et une expiration, mais le mécanisme inspecté ne crée pas à lui seul une notification utilisateur destinée à une boîte e-mail commune.
- Les invitations Livreur sont un flux Pharmacie séparé.
- Les affectations directes Parapharmacie et les membres Prestations ne doivent pas être transformés artificiellement en invitations e-mail.
- L'outbox e-mail actuelle exige un user_id et résout l'adresse via auth.users; elle ne peut donc pas adresser directement une invitation à une adresse qui n'a pas encore de compte.

**Conséquence :** une outbox d'invitation doit accepter un destinataire e-mail externe, conserver un identifiant d'événement idempotent et fournir un lien/token d'invitation sans créer de compte prématurément. Les fonctions d'acceptation et leurs contrôles par univers restent souverains.

### Décision d'ingénierie de sécurité

Je n'ai pas ajouté une migration spéculative et je n'ai pas modifié le worker pour calculer des dates à partir de monthly_fee_fcfa. Cela aurait créé de fausses échéances, des rappels erronés et potentiellement des blocages d'accès non autorisés.

**État de la demande « fais-le » :** audit approfondi terminé ; implémentation applicative non commencée, car le schéma de facturation mensuelle des partenaires et le contrat de délivrance des invitations externes ne sont pas encore présents. Aucun changement Supabase ou Production n'a été effectué.


## Contradiction technique après validation de la règle commune — 17 novembre 2026

### Hypothèse à réfuter
« Il suffit de démarrer toutes les échéances à la validation du dossier ou à la première preuve de paiement reçue. »

Cette hypothèse est fausse :
- admin_partner_dossiers contient un montant mensuel, mais aucune date de début de cycle, échéance, période réglée, statut de paiement ni référence de paiement confirmée.
- La fonction admin_confirmer_reglement_promoteur confirme un règlement Promoteur et crée sa période mensuelle à partir de sa confirmation ; elle est spécifique au Promoteur et ne crée pas les périodes des dossiers Parapharmacie, Examens ou Prestations.
- naxa_match_universe_payment_sms rapproche les preuves d'un paiement de réservation Client/partenaire. Il crée une confirmation financière liée à universe_reservations, pas une souscription mensuelle du partenaire. Réutiliser cette confirmation comme preuve d'abonnement serait une confusion de domaine.
- La déclaration manuelle d'un paiement ou l'intention de paiement submitted n'est pas une confirmation financière. Seul un événement de confirmation NAXA vérifié peut déclencher le cycle.
- private.naxa_partner_has_confirmed_payment contrôle actuellement la validation du dossier et l'abonnement courant du Promoteur propriétaire ; il ne prouve pas un paiement d'abonnement propre à chaque dossier partenaire.

### Conséquence par contradiction
Si le moteur utilisait la validation du dossier, un partenaire pourrait recevoir une échéance avant tout paiement confirmé. Si le moteur utilisait une réservation Client ou un SMS simplement déclaré, une transaction commerciale pourrait être interprétée à tort comme le premier paiement d'abonnement. Dans les deux cas, NAXA générerait de fausses échéances et pourrait déclencher des rappels ou blocages injustifiés.

### Correction sûre requise avant activation
Créer une source de vérité de souscription professionnelle commune aux quatre univers, liée à l'entité facturée et à l'événement de confirmation du premier règlement. Elle devra conserver au minimum : univers autorisé, partenaire/pharmacie facturé, montant et devise FCFA, date de confirmation vérifiée, début et fin de période, prochaine échéance, statut, référence et preuve de confirmation, auteur/mécanisme de confirmation, horodatages et idempotence. Les règles d'accès et de suspension resteront séparées par univers et ne seront pas réactivées automatiquement par la seule confirmation d'un paiement.

Le moteur J-5 devra lire uniquement cette source de vérité. Les dossiers validés sans premier paiement confirmé resteront sans cycle et sans rappel. Les paiements de réservations Clients, les conventions à date d'expiration et les simples déclarations ne seront jamais convertis en souscriptions.

### État d'implémentation
**PARTIEL / BLOQUÉ À LA SOURCE DE VÉRITÉ** : la règle métier universelle est documentée. Aucun code de facturation ni migration n'a été ajouté dans cette passe, car le schéma actuel ne permet pas de relier sans ambiguïté un paiement d'abonnement confirmé aux quatre catégories d'entités. Aucun changement Supabase n'a été appliqué et aucun déploiement Production n'a été effectué.


## Décision complémentaire — payeur propre à chaque structure (17 novembre 2026)

**Choix A validé : chaque structure contractante règle son propre abonnement.** Le Promoteur ne devient pas payeur collectif des Parapharmacies, centres d'Examens médicaux ou structures de Prestations à domicile du seul fait qu'il est Promoteur ou qu'il détient plusieurs structures. Un contrat collectif ne pourra déroger à cette règle qu'avec un accord explicite, un payeur désigné et une répartition contractuelle des obligations. Un défaut de paiement ne suspend que le périmètre du contrat concerné, selon ses règles propres.

### Contrôle de la piste de confirmation universelle

La table Replay `naxa_universe_payment_confirmations` ne peut pas servir de preuve d'abonnement : ses colonnes obligatoires `reservation_id` et `client_id`, ainsi que sa relation à `naxa_universe_payment_intents`, l'identifient comme confirmation d'un paiement de réservation Client. Elle est donc exclue du déclenchement des cycles partenaires.

Le flux `admin_confirmer_reglement_promoteur` confirme actuellement un règlement lié à `abonnements_promoteurs` et crée sa période mensuelle Promoteur. Aucun événement équivalent propre à chaque structure contractante des trois autres univers n'a été établi dans le schéma contrôlé.

**Verdict technique maintenu : PARTIEL / BLOQUÉ À LA SOURCE DE VÉRITÉ.** La règle du payeur est désormais décidée, mais aucune migration, écriture Replay ou modification du worker n'est autorisée sur la base d'une fausse équivalence avec les paiements de réservation. Il faut un événement de règlement d'abonnement confirmé, relié sans ambiguïté à la structure qui paie, avant de calculer son premier cycle et son J-5. Les cycles historiques valides restent à préserver.


## Implémentation initiale — abonnement indépendant par structure (17 novembre 2026)

### Contrat et source de vérité

- Tables créées : \`partner_subscriptions\` (un contrat par \`partner_id\`) et \`partner_subscription_payments\` (historique des déclarations et décisions).
- Univers pris en charge : exclusivement \`parapharmacie\`, \`examens\`, \`prestations\`. Aide, dispositifs médicaux/connectés et autres catégories restent hors périmètre.
- Le titulaire propriétaire (\`partner_members.member_role='owner'\`) déclare le règlement de sa structure. Le tarif est relu côté serveur depuis \`admin_partner_dossiers.monthly_fee_fcfa\`, jamais accepté comme valeur faisant autorité depuis le navigateur.
- Une déclaration crée un règlement \`pending\` et une notification ; elle ne crée aucune période et ne change aucun droit d'accès. La référence normalisée est unique et une seule déclaration peut être en attente par structure.
- L'Administration confirme ou refuse après contrôle manuel de l'encaissement réel. La confirmation produit le reçu et la période, démarre le premier cycle à la date locale de confirmation NAXA, puis prolonge une période indépendante existante à partir du lendemain de son échéance. Une déclaration ou un SMS isolé ne vaut pas confirmation.
- Les coordonnées NAXA sont prises en instantané depuis \`naxa_payment_destinations\`. Le paiement de réservation Client (\`naxa_universe_payment_confirmations\`) reste exclu.

### Accès et historique

- \`private.naxa_partner_has_confirmed_payment(uuid)\` vérifie désormais le cycle propre à la structure, le dossier validé, le statut partenaire actif, l'univers activé et l'identité titulaire active. L'abonnement Promoteur n'est plus la source de vérité pour ces trois univers indépendants.
- Les structures déjà actives et dont l'ancien accès était encore valide conservent cet accès jusqu'à l'échéance historique de l'abonnement Promoteur. Cette période est marquée \`legacy_access_until\`, sans être transformée en paiement propre à la structure et sans renouvellement implicite.
- La confirmation ne réactive jamais \`profiles.actif\`. Un compte globalement suspendu reste suspendu.
- L'expiration ne suspend que le contrat de la structure concernée ; elle ne désactive pas le profil global ni les autres structures.

### Rappels et interfaces

- Synchronisation d'expiration et rappels J-5 idempotents par structure via \`naxa_process_partner_subscription_cycles()\`.
- Job pg_cron Replay créé : \`naxa-partner-subscription-cycle-hourly\`, \`20 * * * *\`.
- Les types de notification partenaires ont été ajoutés à l'outbox e-mail existante. La route \`/api/cron/validite\` appelle aussi les deux RPC partenaires avant de vider l'outbox.
- Espace titulaire : \`/partenaire/abonnement\` ; revue Admin : \`/admin/abonnements-partenaires\`, ajoutée à la navigation Admin.

### Migrations Replay appliquées

- \`20261117200000_partner_independent_subscription_cycles\`
- \`20261117201000_partner_subscription_read_api_and_date_guard\`
- \`20261117202000_partner_subscription_read_api_fix\`
- \`20261117203000_partner_subscription_cron_schedule\`

### Vérifications et limites

- Replay : les quatre migrations sont appliquées ; tables présentes ; RLS activée sur les deux tables et politiques SELECT titulaires/membres/Admin en place.
- Privilèges contrôlés : déclaration et confirmation refusées à \`anon\`, autorisées à \`authenticated\` avec contrôle métier dans les RPC ; synchronisation et rappels réservés à \`service_role\`.
- Appels non authentifiés aux RPC de déclaration, lecture titulaire, confirmation Admin et liste Admin : rejetés avec \`42501\` attendu.
- Job pg_cron présent (job 13). Exécution immédiate sans effet : 0 expiration, 0 rappel.
- Données Replay : 0 dossier de ces trois univers, 0 abonnement et 0 paiement. Il n'existe donc pas de preuve positive de déclaration → confirmation → cycle → J-5 dans Replay à ce stade.
- Advisor sécurité : aucun finding visant les deux nouvelles tables. Advisor performance : quatre index de FK signalés « unused » parce que Replay ne contient aucune ligne ; les index sont conservés pour couvrir les FK.
- Build/TypeScript et test navigateur non exécutés dans ce passage. Aucune donnée Production et aucun déploiement Vercel touchés.

**Verdict : PARTIEL.** Le moteur DB, les RPC, le job horaire et les deux interfaces sont versionnés et déployés sur Replay ; le parcours positif reste à prouver avec un dossier partenaire réel/synthétique autorisé et le run qualité applicatif. Le cycle n'est pas déclaré AU VERT.


## Vérification SMS croisée et ouverture du parcours avant activation (17 novembre 2026)

- Le flux partenaire existant \`naxa_partner_payment_notification_candidates\` est désormais rapproché des règlements d'abonnement propres à la structure.
- La déclaration d'abonnement, le SMS original de débit partagé depuis un appareil Partenaire enrôlé et le SMS de crédit capturé sur un appareil Admin enrôlé peuvent être reçus dans n'importe quel ordre. Les triggers relancent le rapprochement à l'arrivée des preuves ; la déclaration appelle aussi le rapprochement après insertion.
- L'auto-confirmation exige une paire unique et cohérente : même structure, référence normalisée, canal, montant, numéro payeur, destination NAXA, date/heure fournisseur, hash de payload distinct, appareil Partenaire actif, appareil Admin actif, profils actifs et Admin distinct du déclarant. Seul \`voluntary_sms_share\` constitue la preuve de débit exploitable automatiquement ; une notification Android seule reste un candidat de revue.
- La capture SMS crédit Admin déjà existante déclenche le rapprochement partenaire quand aucun règlement Promoteur ne lui est associé. Si les preuves ne forment pas une paire complète, le règlement reste en attente et l'Admin peut confirmer/refuser manuellement.
- Les propriétaires de structures validées dont le partenaire est encore \`pending\` peuvent enrôler leur appareil et partager le SMS nécessaire au premier paiement. Les gestionnaires ne bénéficient pas de cette ouverture pré-activation.
- Le garde-fou DB refuse une confirmation automatique si le payeur et l'Admin sont le même utilisateur.
- Le RPC Admin manuel reste disponible et marque la source \`manual_admin\`; l'auto-confirmation marque \`paired_sms\`.

**Test transactionnel Replay (ROLLBACK) :** une structure Examens synthétique a été créée dans un sous-bloc transactionnel, avec déclaration, candidat de débit Partenaire et événement de crédit Admin. Le rapprochement a confirmé le paiement, produit un reçu et une période, activé le contrat/la structure et marqué l'événement Admin \`confirmed\`. Les données de test ont été annulées ; contrôle post-test : 0 partenaire temporaire, 0 abonnement, 0 règlement, 0 candidat, 0 événement et 0 notification de confirmation persistants.

**Limite de configuration Replay :** \`naxa_payment_destinations\` est vide (aucune destination Orange Money ou MTN active). Le formulaire bloque donc correctement la déclaration réelle et la route de capture Admin refuse un canal sans destination configurée. Le test transactionnel a utilisé une destination synthétique en ROLLBACK ; aucune coordonnée réelle n'a été inventée.

**Verdict : PARTIEL.** Le moteur de rapprochement SMS croisé est testé en transaction et les données sont annulées. Le parcours HTTP/Android réel, la configuration des destinations, l'envoi e-mail effectif et le build/TypeScript restent à prouver. Aucun déploiement Production.


## Verrouillage des frontières de facturation — Promoteur ≠ partenaire indépendant (17 novembre 2026)

L'audit a révélé trois anciens couplages qui auraient contredit le choix A malgré le nouveau moteur :

1. \`admin_valider_dossier_partenaire\` activait auparavant une structure dès que l'abonnement Promoteur était courant et pouvait accepter l'univers Aide. Il valide désormais uniquement Parapharmacie, Examens médicaux et Prestations à domicile ; sans cycle propre confirmé ou accès historique valide, le partenaire reste \`pending\` et son univers désactivé.
2. \`admin_confirmer_reglement_promoteur\` réactivait auparavant les partenaires validés du Promoteur. Ce comportement est supprimé : le règlement Promoteur renouvelle uniquement son périmètre Promoteur/Pharmacie.
3. \`synchroniser_validite_pharmacies\` créait auparavant des verrous Promoteur à partir de dossiers partenaires. Les verrous sont désormais fondés sur le propre abonnement Promoteur actif/impayé ; l'expiration partenaire est traitée exclusivement par \`partner_subscriptions\`.

Le RPC \`promoteur_soumettre_reglement\` n'accepte plus les titulaires de dossiers partenaires comme Promoteurs : il exige un profil actif de rôle Promoteur. Les deux flux de souscription (Promoteur et structure) se protègent mutuellement contre la réutilisation d'une référence déjà revendiquée dans l'autre flux ou dans une confirmation de réservation Client.

### Tests transactionnels complémentaires (ROLLBACK)

- Validation d'un dossier Examens avec univers/feature flag activés temporairement dans le sous-bloc : dossier \`validated\`, partenaire toujours \`pending\`, univers toujours désactivé, contrat propre \`pending_payment\`. Aucun paiement Promoteur n'a été utilisé. Le bloc a été annulé ; les feature flags Replay sont restés désactivés.
- Rappel J-5 : premier passage émet exactement un rappel ; second passage émet zéro rappel supplémentaire.
- Expiration : un contrat échu passe à \`expired\`, tandis que le partenaire reste \`active\` et le profil global reste actif. L'autre structure non échue n'est pas modifiée.
- Contrôle post-rollback : zéro partenaire temporaire, zéro contrat, zéro règlement, zéro candidat SMS, zéro événement Admin et zéro notification de test persistants.

### Blocages de configuration constatés sur Replay

- Les feature flags et univers \`parapharmacie\`, \`examens\`, \`prestations\` sont tous désactivés. Aucune activation permanente n'a été faite.
- \`naxa_payment_destinations\` ne contient aucune destination active MTN/Orange. La soumission de paiement est donc correctement bloquée tant que les coordonnées réelles NAXA ne sont pas configurées.
- Aucun build/TypeScript/CI ni parcours HTTP/Android n'a été exécuté. Aucun Production ni déploiement Vercel touché.

**Verdict : PARTIEL.** Les frontières A sont appliquées côté DB et testées par transactions annulées. L'activation fonctionnelle réelle dépend des feature flags, des destinations de paiement, puis du run qualité et du parcours Android/Admin.


## Historique final Replay — migrations appliquées

Les onze migrations du lot sont présentes dans l'historique Supabase Replay, dans cet ordre :

1. \`20261117060519 partner_independent_subscription_cycles\`
2. \`20261117060614 partner_subscription_read_api_and_date_guard\`
3. \`20261117060720 partner_subscription_read_api_fix\`
4. \`20261117060758 partner_subscription_cron_schedule\`
5. \`20261117060937 partner_subscription_cancelled_payment_guard\`
6. \`20261117060948 partner_subscription_disciplinary_access_guard\`
7. \`20261117061242 partner_subscription_paired_sms_verification\`
8. \`20261117061423 partner_subscription_sms_distinct_actor_guard\`
9. \`20261117061753 decouple_partner_validation_from_promoteur_subscription\`
10. \`20261117061839 isolate_partner_and_promoteur_payment_references\`
11. \`20261117061911 exclude_non_billable_partner_universes\`

Le job \`naxa-partner-subscription-cycle-hourly\` est présent à \`20 * * * *\`. L'Advisor sécurité ne signale aucun finding sur les deux nouvelles tables ; trois index d'audit FK restent signalés INFO/unused car Replay ne contient aucun règlement. 

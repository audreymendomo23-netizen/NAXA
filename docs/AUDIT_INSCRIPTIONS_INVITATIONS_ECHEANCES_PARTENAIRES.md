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

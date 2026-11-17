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

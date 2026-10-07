# NAXA — REPRISE EXACTE

> **CHECKPOINT COURANT UNIQUE**

## Identité

- checkpoint_id : `CP-0001-CONTINUITE`
- checkpoint_status : 🟢 PARTIE 6 — VERT / 100 %
- checkpoint_scope : clôture de la Partie 6 et préparation du chantier Pilotage 360°
- branch : `rewrite/naxa-from-main-20261007`
- current_sha : `4d8fb7c43ebc8642e644e96aeec4f37969c93a82`
- main_sha : `82d2145cea6d6d162405c3e74d3f21400ba5b763`
- last_ci_test_sha : `4d8fb7c43ebc8642e644e96aeec4f37969c93a82`

## Position fonctionnelle exacte

- chantier : Reconstruction / Réconciliation NAXA
- dernières parties clôturées : Parties 1, 2, 3, 4, 5 et 6
- statut Partie 5 : 🟢 VERT — 100 %
- preuve fonctionnelle : replay Supabase transactionnel PASS avec ROLLBACK.
- preuve CI : CircleCI pipeline #3, workflow `part5_gate`, job `part5_check`, **Success**, 26 s.
- correction racine : le scope `RESEAU` exige `pharmacie_id = NULL`, alors que l'ancien chemin injectait `p_pharmacie`; migration 047 corrige l'attribution et la révocation.
- aucune donnée Production persistée.
- `main` et Production restent inchangés.

## exact_resume_point

**Ne pas recommencer les Parties 1 à 5.**

Reprendre sur :

**Chantier suivant → Pilotage 360°, Partie 1 : audit et matrice canonique des KPI**, après validation explicite du fondateur.

## Fichiers métier de la Partie 5

- `supabase/migration_047_network_scope_pilotage_promoteur.sql`
- `supabase/tests/047_network_scope_pilotage_promoteur.sql`
- `.github/workflows/naxa-part5-gate.yml`
- `.circleci/config.yml`

## Dernière réalité connue

- `main` inchangé.
- Production inchangée.
- Branche de continuation : `rewrite/naxa-from-main-20261007`.
- SHA de clôture Partie 5 : `935026a21dfdadff10b0d44e1bc0aa83da0459a6`.
- Aucun merge `main`.
- Aucun déploiement Production.

## Interdictions au prochain démarrage

- pas de nouvelle branche sans nécessité technique démontrée ;
- pas de merge main ;
- pas de Production ;
- pas de reprise depuis zéro.


## Clôture Partie 6 — Réconciliation finale Promoteur

- checkpoint_status : 🟢 PARTIE 6 — VERT / 100 %
- branch : `rewrite/naxa-from-main-20261007`
- clôture CI : SHA `4d8fb7c43ebc8642e644e96aeec4f37969c93a82`
- CircleCI pipeline #13 : workflow `part6_gate`, job `part6_check` = **Success**.
- preuve fonctionnelle : replay Supabase des migrations 043→048 + test contradictoire = PASS avec ROLLBACK.
- cause racine corrigée : `private.naxa_promoteur_valide()` ne dépend plus de l'ancien abonnement par pharmacie et délègue exclusivement à la validité canonique Promoteur.
- durcissement : les fonctions mutantes de synchronisation ne sont plus exposées aux rôles client.
- aucune donnée Production persistée ; `main` inchangé ; aucun merge ; aucun déploiement Production.

## exact_resume_point

**Parties 1 à 6 : ne pas recommencer.**

Reprendre sur : **Pilotage 360° → Partie 1 : audit de l'existant + matrice KPI canonique**, sans codage prématuré.
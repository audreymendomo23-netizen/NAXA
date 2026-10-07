# NAXA — REPRISE EXACTE

> **CHECKPOINT COURANT UNIQUE**

## Identité

- checkpoint_id : `CP-0001-CONTINUITE`
- checkpoint_status : 🟢 CONTINUITÉ INSTALLÉE
- checkpoint_scope : installation initiale du système de reprise
- branch : `rewrite/naxa-from-main-20261007`
- anchor_sha : `f644b4d42a48cda57cc1a7d9c6f26867852ac56e`
- main_sha : `82d2145cea6d6d162405c3e74d3f21400ba5b763`

## Position fonctionnelle exacte

- chantier : Reconstruction / Réconciliation NAXA
- dernière partie fonctionnellement clôturée : Partie 4
- partie courante : Partie 5 — Scope réseau + Pilotage Promoteur
- statut Partie 5 : 🟡
- blocage : CI GitHub échoue avant l'exécution des steps ; aucune preuve CI exploitable n'est déclarée.

## Dernier point fonctionnel établi

La correction de `migration_047_network_scope_pilotage_promoteur.sql` a résolu la contradiction du scope `RESEAU` : `pharmacie_id` doit rester NULL pour ce scope. Le replay Supabase transactionnel et les contrôles fonctionnels ont été validés avec rollback.

## exact_resume_point

**Ne pas recommencer les Parties 1 à 4.**

Reprendre sur :

**Partie 5 → preuve CI réelle du gate → comprendre/corriger le blocage avant steps → relancer → obtenir 🟢.**

## Première action obligatoire à la prochaine reprise

Vérifier d'abord le SHA réel de `rewrite/naxa-from-main-20261007`, puis lire le workflow `.github/workflows/naxa-part5-gate.yml` et les derniers runs CI. Ne modifier aucun autre chantier avant cette vérification.

## Fichiers métier de la Partie 5

- `supabase/migration_047_network_scope_pilotage_promoteur.sql`
- `supabase/tests/047_network_scope_pilotage_promoteur.sql`
- `.github/workflows/naxa-part5-gate.yml`

## Dernière réalité connue

- `main` inchangé.
- Production inchangée.
- Branche de continuation : `rewrite/naxa-from-main-20261007`.
- L'état fonctionnel d'ancrage est `f644b4d42a48cda57cc1a7d9c6f26867852ac56e`.

## Interdictions au prochain démarrage

- pas de nouvelle branche ;
- pas de merge main ;
- pas de Production ;
- pas de déclaration 🟢 sans preuve CI ;
- pas de reprise depuis zéro.

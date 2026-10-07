# NAXA — REPRISE EXACTE

> **CHECKPOINT COURANT UNIQUE**

## Identité

- checkpoint_id : `CP-0001-CONTINUITE`
- checkpoint_status : 🟡 PARTIE 5 — CI BLOQUÉE PAR ALLOCATION RUNNER
- checkpoint_scope : installation initiale du système de reprise
- branch : `rewrite/naxa-from-main-20261007`
- anchor_sha : `70486d3244c8132dfb82b1220bd86696b97afbb3`
- main_sha : `82d2145cea6d6d162405c3e74d3f21400ba5b763`
- current_sha : `70486d3244c8132dfb82b1220bd86696b97afbb3`
- last_ci_test_sha : `940aea76e2553378d56be49b451e2c41d1b11771`

## Position fonctionnelle exacte

- chantier : Reconstruction / Réconciliation NAXA
- dernière partie fonctionnellement clôturée : Partie 4
- partie courante : Partie 5 — Scope réseau + Pilotage Promoteur
- statut Partie 5 : 🟡
- blocage : CI GitHub échoue avant l'exécution des steps ; aucune preuve CI exploitable n'est déclarée.
- preuve du 07/10/2026 : run `37653058140`, job `112901096630`, `steps=null`, durée facturable `0 ms` ; le workflow Partie 5 en `ubuntu-latest` échoue comme les autres jobs du workflow qualité en `ubuntu-24.04` sur le même push.
- conclusion : le blocage n'est pas démontré comme provenant du SQL ou du YAML du gate ; il se situe au niveau de l'allocation/exécution des runners GitHub. Aucun motif de facturation précis n'est inventé faute de message d'erreur runner accessible.

## Dernier point fonctionnel établi

La correction de `migration_047_network_scope_pilotage_promoteur.sql` a résolu la contradiction du scope `RESEAU` : `pharmacie_id` doit rester NULL pour ce scope. Le replay Supabase transactionnel et les contrôles fonctionnels ont été validés avec rollback.

## exact_resume_point

**Ne pas recommencer les Parties 1 à 4.**

Reprendre sur :

**Partie 5 → preuve CI réelle du gate → comprendre/corriger le blocage avant steps → relancer → obtenir 🟢.**

## Première action obligatoire à la prochaine reprise

Vérifier le SHA réel `940aea76e2553378d56be49b451e2c41d1b11771`, le workflow `.github/workflows/naxa-part5-gate.yml` et les runs `37653058140` / `37653057958`. La correction `ubuntu-24.04 → ubuntu-latest` a été appliquée mais n'a pas levé le blocage. Prochaine action technique : obtenir la cause d'allocation runner côté GitHub (quota/permission/disponibilité) sans souscrire de service payant, puis relancer le même gate.

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

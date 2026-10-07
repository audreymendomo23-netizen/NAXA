# NAXA — REPRISE EXACTE

> **CHECKPOINT COURANT UNIQUE**

## Identité

- checkpoint_id : `CP-0004-PILOTAGE360-PART2-REPRISE`
- checkpoint_status : 🟠 PILOTAGE 360° PARTIE 2 — EN COURS / NON VERT
- checkpoint_scope : clôture de la Partie 6 et préparation du chantier Pilotage 360°
- branch : `rewrite/naxa-from-main-20261007`
- current_sha : `7ddde25d03bd535290111efbfa1510d0833cb06e`
- main_sha : `82d2145cea6d6d162405c3e74d3f21400ba5b763`
- last_ci_test_sha : `81dc2673ca9b182776ab87fbebbbe230ce8c9a5a`

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

**Pilotage 360° → Partie 2 : socle Performance.**

Dernières corrections appliquées :
- test 049 rendu autonome avec création transactionnelle de p1 actif et p2 inactif ;
- CircleCI fonctionnel déplacé sur exécuteur machine ;
- délai de sortie porté à 30 min ;
- documentation réconciliée.

**Blocage restant : preuve CI fonctionnelle CircleCI non remontée dans GitHub.**
Le chantier reste 🟠 et doit être poursuivi jusqu’au replay fonctionnel PASS + preuve CI avant toute validation de la Partie 2.

Aucun merge main. Aucune persistance Production.


## Clôture Pilotage 360° — Partie 3

- checkpoint_id : CP-0005-PILOTAGE360-PART3-SECURITY-NETWORK
- checkpoint_status : 🟢 PARTIE 3 — VERT / 100 %
- branch : rewrite/naxa-from-main-20261007
- main : inchangé
- Production : inchangée
- migration : supabase/migration_050_security_network_hardening.sql
- test : supabase/tests/050_security_network_hardening.sql
- preuve fonctionnelle : replay Supabase réel transactionnel PASS + ROLLBACK, y compris compatibilité avec l'ancien appel 3 paramètres.
- corrections : moteur de privilèges descendant, expiration Promoteur, scope RESEAU, catalogue de privilèges historique/canonique.
- CI : gate structurel ajouté ; aucune preuve fonctionnelle CI disponible via les connecteurs exposés.

### exact_resume_point

Pilotage 360° → Partie 4.

Ne pas reprendre la Partie 2 Performance : elle reste explicitement en pause et non verte.

- Sécurité sessions : migration 051 ; maximum 4 sessions, 5e refusée, aucune éviction automatique, audit session_audit ; test 051 PASS avec ROLLBACK.


## CP-0006-PILOTAGE360-PART4-DIRECTION-360

- Date : 07/10/2026
- Objet : clôture de Pilotage 360° — Partie 4, Direction 360°.
- Branche : rewrite/naxa-from-main-20261007.
- Périmètre canonique : cockpit Direction NAXA consolidant réseau, commercial, performance et sécurité ; métriques ERP non disponibles explicitement exclues.
- Correction préalable : la migration 049 contenait deux contradictions SQL avec l'état réel : `CREATE VIEW IF NOT EXISTS` invalide sur PostgreSQL et `CREATE OR REPLACE VIEW` incompatible avec les colonnes historiques de `v_reservations_ca`. La migration a été réconciliée par suppression/recréation transactionnelle du view canonique.
- Implémentation : `supabase/migration_052_direction_360.sql`.
- Test contradictoire : `supabase/tests/052_direction_360.sql`.
- Preuve fonctionnelle : replay transactionnel réel Supabase des migrations 043→052 + test Direction 360 = PASS.
- Preuve de rollback : PASS ; après rollback, `VIEW_DIRECTION_360` n'est pas persisté, `session_audit` n'est pas persisté et l'historique Supabase reste inchangé à la migration 042.
- Sécurité : Direction 360 réservée à la fonction Admin ; privilège catalogue `VIEW_DIRECTION_360` non délégable/gouvernance.
- main et Production restent inchangés.
- CI : gate dédiée Partie 4 ajoutée et déclenchée par le commit de clôture ; validation finale uniquement après statut Success.

### exact_resume_point

**Pilotage 360° → après validation de la Partie 4 Direction 360°.**

- Ne pas modifier main.
- Ne pas déployer Production.
- Ne pas appliquer les migrations 043→052 en Production sans autorisation explicite.

# NAXA — REPRISE EXACTE

> **CHECKPOINT COURANT UNIQUE — CP-0009**

## Identité courante

- checkpoint_id : `CP-0009-PILOTAGE360-PART2-PERFORMANCE`
- checkpoint_status : 🟢 SOCLE PERFORMANCE — VERT / 100 % après correction et preuve
- branch : `rewrite/naxa-from-main-20261007`
- main_sha : `82d2145cea6d6d162405c3e74d3f21400ba5b763`
- état Supabase Production : migration 042, inchangé
- état main : inchangé

## exact_resume_point

**Après CP-0009 : attendre la validation explicite du fondateur avant tout nouveau chantier.**

## Dernière correction

- `supabase/migration_052_direction_360.sql` compte désormais les Responsables via `fonction_interne='responsable'`, conformément au modèle canonique.
- `supabase/tests/052_direction_360.sql` contient un test contradictoire dédié au comptage des Responsables.
- Replay fonctionnel transactionnel réel : PASS + ROLLBACK après correction.
- Vérification post-rollback : migration Production toujours 042, fixture Direction supprimée, `session_audit` non persistée, `stats_direction_360` non persistée.

## Règles permanentes

- Aucun merge vers `main` sans autorisation explicite.
- Aucun déploiement ou migration persistante Production sans autorisation explicite.
- Aucun service payant.
- Aucune nouvelle branche sans nécessité technique démontrée.
- Aucun 🟢 sans preuve.

---

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


## CP-0009 — Pilotage 360° Partie 2 : socle Performance

- 🟢 **VERT — 100 %**.
- Migration : `supabase/migration_049_pilotage_performance_socle.sql`.
- Test : `supabase/tests/049_pilotage_performance_socle.sql`.
- Contradictions corrigées : collisions de fixtures, couplage Auth du test, gate CI incohérent et exécuteur CI inadapté.
- Preuve fonctionnelle Supabase réelle : PASS + ROLLBACK.
- Production : migration 042, inchangée.
- main : inchangé.
- Documentation : `docs/PILOTAGE_360_PART2_PERFORMANCE_GREEN.md`.

### exact_resume_point

**Après CP-0009 : attendre la validation explicite du fondateur avant tout chantier suivant.**

Ne pas merger `main`.
Ne pas persister les migrations 043→052 en Production.
Ne pas déployer Production.


## CP-0009 — Autorité de reprise

La Partie 2 Performance est clôturée **🟢 100 %**. Toute formulation historique indiquant qu'elle reste en pause/non verte est obsolète. Le checkpoint courant unique est CP-0009.


## CP-0011 — Réconciliation v3.7 clôturée

- 🟢 Réconciliation documentaire / matrice de fusion : 100 %.
- Livrables : `docs/CAHIER_DES_CHARGES.md`, `docs/FUSION.md`, `docs/FUSION_FICHES.md`, `docs/TRACABILITE.md`.
- Production : migration 042, inchangée.
- main : inchangé.
- Prochain chantier : **Qualité**.
- Attendre la validation explicite du fondateur avant toute construction fonctionnelle suivante.

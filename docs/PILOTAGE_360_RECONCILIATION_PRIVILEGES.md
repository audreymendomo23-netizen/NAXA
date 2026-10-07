# NAXA — Réconciliation globale des privilèges

Date : 07/10/2026
Branche : `rewrite/naxa-from-main-20261007`

## Objet

Vérifier que le moteur de privilèges post-Partie 4 → Partie 6 est réellement cohérent après les couches Architecture, délégation, scope réseau, réconciliation Promoteur et sécurité/réseau.

## 🔴 Contradiction trouvée

Un mécanisme legacy restait actif : `trg_naxa_provision_on_architecture` sur `pharmacie_architectures` appelait automatiquement `naxa_provision_promoteur_pharmacie()`.

La migration 046 supprimait le trigger réseau `trg_naxa_provision_promoteur`, mais pas ce second trigger d'architecture.

**Cause racine :** le provisioning legacy avait deux points d'entrée et la désactivation n'en couvrait qu'un.

**Impact :** une création/activation d'architecture pouvait encore attribuer automatiquement des privilèges, contrairement au contrat canonique : l'attribution effective doit passer exclusivement par `naxa_grant_privilege()`.

## Correction

`supabase/migration_046_disable_legacy_privilege_provisioning.sql` supprime désormais :
- `trg_naxa_provision_promoteur` ;
- `trg_naxa_provision_on_architecture`.

La fonction legacy reste présente pour compatibilité historique, mais son exécution est révoquée pour `public`, `anon` et `authenticated`.

Test ajouté :
`supabase/tests/046_disable_legacy_privilege_provisioning.sql`.

## Preuve transactionnelle réelle

Replay réel Supabase : migrations 043→052 + test 046 + test 052, dans une transaction externe.

Résultats de l'audit avant ROLLBACK :
- 106 privilèges actifs ; 0 domaine/family manquant ;
- 0 attribution active dans la fixture réelle ;
- 0 attribution orpheline ;
- 0 privilège de gouvernance attribué ;
- 0 niveau hors bornes ;
- 0 scope RESEAU avec pharmacie_id non NULL ;
- 0 scope non-RESEAU avec pharmacie_id NULL ;
- 0 attribution RESEAU à un non-Promoteur ;
- 0 doublon de lien Promoteur→pharmacie actif ;
- 0 trigger legacy de provisioning ;
- fonction legacy non exécutable par public/authenticated.

Le replay est **PASS**, puis **ROLLBACK**.

## Vérification post-rollback

Supabase Production reste à la migration 042. Les objets temporaires des migrations 043→052 ne sont pas persistés par ce replay. Aucune donnée Production n'a été injectée.

## Verdict

**Réconciliation globale des privilèges : 🟢 100 %.**

Aucun merge `main`, aucun déploiement Production, aucun service payant.

## Point d'arrêt

Attendre la validation explicite du fondateur avant le chantier canonique suivant.

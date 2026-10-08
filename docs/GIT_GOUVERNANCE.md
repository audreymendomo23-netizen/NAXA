# NAXA — Gouvernance Git / Niveau 2

Mise à jour : 08/10/2026.

## Références actives
- **Source de vérité :** `main` — aucun changement effectué pendant ce chantier.
- **Chantier courant :** `rewrite/naxa-from-main-20261007`.
- **Base historique de validation CI :** `consolidation`.
- **PR active autorisée à rester ouverte :** #30, uniquement pour le gate Qualité.

## Branches historiques
Les branches `feat/*`, `fix/*`, `docs/*`, `reconcile/*`, `reconciliation/*`, `naxa-dev` et `naxa-v2` restent des archives Git tant qu'elles ne sont pas explicitement désignées comme chantier courant. Elles ne sont pas supprimées : leur historique constitue une preuve de continuité.

## PR obsolètes fermées dans ce niveau
PR #7, #22, #23, #24, #25, #33 et #34 ont été fermées car leur travail est historique ou déjà réconcilié sur la branche de travail. La fermeture ne supprime ni les commits ni les branches.

## Contrôle de collision
Le dépôt avait deux migrations portant le numéro `064` et deux tests portant le numéro `060`. Le pharmacien a été renuméroté sans changer son contenu :
- `migration_064_caisse_modes_operateurs.sql` reste le numéro 064 ;
- `migration_065_pharmacien_consultation_prescription.sql` devient unique ;
- `tests/060_caisse_modes_operateurs.sql` reste le test 060 ;
- `tests/061_pharmacien_consultation_prescription.sql` devient unique.

## Règle
Un seul chantier actif par objectif. Une branche historique n'est pas une seconde source de vérité. Aucun merge vers `main` n'est réalisé dans ce niveau.

**Statut Niveau 2 : 🟢 GIT / STRUCTURE / HISTORIQUE — CORRIGÉ ET CONSIGNÉ.**

# NAXA — Continuité de référence

Mise à jour : 08/10/2026.

## Source de vérité technique
- Branche de travail courante : `rewrite/naxa-from-main-20261007`.
- HEAD courant de cette branche : `c26efbaa1132b023a0f5b5f5fcc31ca380c53770`.
- `main` courant vérifié : `2e96930c5d8fb0de4ad22cf4f3dd8dd95b4fd471`.
- PR #30 est ouverte, draft, non fusionnée ; son objectif est la preuve CI et non une intégration Production.

## Sources fonctionnelles
1. `naxa_cahier_des_charges_v3_7.md`
2. `naxa_prompt_maitre_fusion_v2.md`
3. `FONCTIONNALITES_VALIDEES.md`
4. `STATUT.md`
5. `README.md`
6. `docs/TRACABILITE.md`
7. ce document, pour la continuité technique datée.

## Méthode obligatoire
AUDIT → CONTRADICTION → CAUSE RACINE → SOLUTION → CONSTRUCTION/CORRECTION → TEST → PREUVE → CONSIGNATION → COMMIT → MAIN → VERT → CONTINUER.

## Règle de statut
Un document peut être au vert documentaire sans rendre une fonctionnalité technique verte. Les statuts fonctionnels restent ceux prouvés dans le registre.

## État au 08/10/2026
- Niveau 1 Documentation/traçabilité : traité par cette mise à jour documentaire.
- Niveau Qualité/CI : 🟢 vert par preuve CircleCI réelle.
- Aucun changement Production.
- Aucun merge de PR #30.

# NAXA — Continuité de référence

Mise à jour : 08/10/2026.

## Source de vérité technique
- Branche de travail courante : `rewrite/naxa-from-main-20261007`.
- HEAD courant de cette branche : `9fde0e1740e44002425b823eda8d6a84219af762`.
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


## Rectification de référence — 08/10/2026

Le HEAD précédent consigné dans ce document était obsolète. Après vérification directe de la branche, le HEAD courant est maintenant `9fde0e1740e44002425b823eda8d6a84219af762`.

Le blocage N4–N15 reste unique : obtenir une exécution reproductible du replay Supabase + tests au HEAD courant. L'accès Supabase fonctionne ; aucune migration de ce chantier n'est appliquée au live pour fabriquer une preuve.


## RECTIFICATION DE CONTINUITÉ — 08/10/2026 — RÉFÉRENCE COURANTE

Cette section supersède toute référence antérieure au HEAD de la branche.

- Branche courante : `rewrite/naxa-from-main-20261007`
- HEAD réel vérifié sur GitHub : `5b24b96098ed240ddb9ade154e22f66969faa2df`
- `main` réel vérifié : `2e96930c5d8fb0de4ad22cf4f3dd8dd95b4fd471`
- Relation Git : branche **ahead de main, behind = 0** ; merge-base = HEAD de `main`
- PR #30 : ouverte, draft, non fusionnée ; base `consolidation`, head = branche courante
- Aucun merge vers `main`
- Aucun déploiement Production
- Les anciens SHA `9fde0e...`, `788a82...`, `a415325...`, `7c5155...` et autres SHA intermédiaires restent historiques et ne doivent plus être utilisés comme position courante.

### N4–N15

Le blocage courant reste la preuve reproductible au **HEAD 5b24b960...**. Les preuves CircleCI antérieures sont conservées comme preuves historiques et ne sont pas réattribuées artificiellement au HEAD courant.

**Statut de continuité documentaire : 🟢 RÉALIGNÉ SUR LE HEAD COURANT.**

# NAXA — Registre des contradictions

Mise à jour : 08/10/2026.

## C-001 — Documentation de reprise obsolète
**Constat :** des SHA de reprise antérieurs restaient présentés sans section de supersession explicite.

**Cause :** historique documentaire non supersédé explicitement.

**Correction :** `docs/CONTINUITE_NAXA.md` et `docs/FUSION.md` portent maintenant les références courantes datées ; l'historique reste conservé.

**Statut : 🟢 RÉSOLU DOCUMENTAIREMENT.**

## C-002 — Documents prescrits absents
**Constat :** le prompt maître prescrit `docs/CAHIER_DES_CHARGES.md`, `docs/FUSION.md`, `docs/TRACABILITE.md` et `CONTRADICTIONS.md` ; plusieurs étaient absents du dépôt courant.

**Correction :** création des documents manquants sans toucher au code métier.

**Statut : 🟢 RÉSOLU DOCUMENTAIREMENT.**

## C-003 — Documentation verte ≠ produit vert
**Constat :** des fonctionnalités restent 🟡 malgré code/tests présents.

**Cause :** preuve CI/SQL manquante.

**Correction :** le niveau 1 ne force aucun statut fonctionnel au 🟢 ; les fiches restent 🟡 tant que leurs preuves manquent.

**Statut : 🟢 RÉSOLU.**

## Règle
Toute nouvelle contradiction documentaire est ajoutée ici avant correction ; aucune ancienne entrée historique n'est supprimée pour masquer un écart.

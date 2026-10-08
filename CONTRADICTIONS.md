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


## C-004 — Multiplication des branches / PR historiques
**Constat :** plusieurs branches et PR ouvertes représentaient des chantiers déjà réconciliés, créant un risque de double source de vérité.

**Cause :** conservation de branches historiques sans classification explicite.

**Correction :** définition d'une branche de chantier courante, d'une base historique et fermeture des PR devenues obsolètes (#7, #22, #23, #24, #25, #33, #34). Les commits/branches restent conservés.

**Statut : 🟢 RÉSOLU.**

## C-005 — Collision de numérotation des migrations/tests
**Constat :** deux migrations `064` et deux tests `060` existaient simultanément.

**Cause :** deux chantiers parallèles avaient choisi le même numéro sans réservation globale.

**Correction :** renumérotation additive du Pharmacien vers migration `065` et test `061`, sans modification du contenu SQL.

**Statut : 🟢 RÉSOLU.**

## C-006 — PR active fonctionnelle doublonnant le chantier courant
**Constat :** les fichiers Pharmacien et Caisse OM/MoMo des PR #33/#34 avaient les mêmes SHA de contenu que la branche de travail.

**Cause :** PR de construction laissées ouvertes après réconciliation.

**Correction :** fermeture des PR #33/#34 ; le travail reste conservé sur la branche courante et dans l'historique.

**Statut : 🟢 RÉSOLU.**

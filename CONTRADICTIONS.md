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


## C-007 — Niveau 3 : qualité outillée frontend
- Cause identifiée : le script `lint` existait mais aucune configuration ESLint ni dépendance ESLint explicite n'était versionnée.
- Correction : ajout de `eslint@8.57.1`, `eslint-config-next@14.2.15` et `.eslintrc.json` basé sur `next/core-web-vitals`.
- Les versions des dépendances sont désormais figées dans `package.json` pour réduire la dérive d'installation.
- Statut de correction statique : 🟢.

## C-008 — Niveau 3 : reproductibilité npm
- Contradiction résiduelle : le dépôt ne contient pas de `package-lock.json`.
- La preuve d'installation réelle est désormais obtenue par CircleCI avec `npm install --no-audit --no-fund`, TypeScript, ESLint et build Next.js tous exécutés avec succès.
- Les versions directes du `package.json` sont figées ; la résolution transitive reste gérée par npm faute de lockfile versionné.
- **Statut : 🟡 amélioration de reproductibilité à traiter séparément ; elle ne bloque plus la preuve d'exécution du gate Niveau 3.**

## C-009 — Niveau 3 : preuve CI externe
- Contradiction initiale : GitHub Actions ne retournait aucune exécution pour les commits du chantier.
- Correction : réactivation du pipeline CircleCI existant via `.circleci/config.yml`, sans service payant supplémentaire et sans modification de `main`.
- Preuve d'exécution réelle : commit `f1fcd801f37989bdd17e667a0e88c17dd3e5f4e6`, contexte `ci/circleci: quality`, état **success**, pipeline CircleCI #167.
- Le gate exécute : installation npm, TypeScript, ESLint et build Next.js.
- **Statut : 🟢 RÉSOLU — preuve CI réelle obtenue.**


## C-010 — Niveau 4 : tests SQL non exécutés par le gate qualité
- Constat : le dépôt contient une suite SQL structurée (supabase/tests/017 à 061), dont les tests Caisse et Pharmacien, mais le gate CircleCI précédemment vert ne lançait que TypeScript/ESLint/build.
- Correction engagée : ajout d'un job CircleCI sql_tests sur exécuteur machine, avec Supabase CLI local, replay de schema.sql + migrations, puis exécution de tous les fichiers supabase/tests/*.sql.
- Preuve actuelle : aucune exécution CircleCI retournée pour le commit d'activation dfc58961fc2f55d501ac7c52ef95b44327258e6a ; le statut GitHub combiné reste vide.
- Validation locale impossible dans l'environnement courant : aucun runtime Docker n'est disponible.
- Validation Supabase distante impossible : le connecteur renvoie « link_id must identify an eligible linked account ».
- Statut : 🔴 À CORRIGER — l'automatisation est construite mais son exécution réelle n'est pas prouvée.

## C-011 — Niveau 4 : tests structurels vs assertions bloquantes
- Les fichiers de test contiennent de nombreuses requêtes select ... as pass : une valeur false peut être produite sans nécessairement faire échouer le processus SQL.
- La robustesse du harnais doit donc vérifier non seulement l'exécution SQL, mais aussi que les assertions attendues sont vraies.
- Statut : 🔴 À AUDITER/CORRIGER dans le chantier tests.

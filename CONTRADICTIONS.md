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


## C-010 — N4 à N15 : environnement de validation non aligné sur le HEAD de travail
- **Constat corrigé :** l'accès Supabase distant fonctionne désormais ; l'ancien message « link_id must identify an eligible linked account » est historique et n'est plus le blocage actuel.
- **Constat actuel :** la base Supabase distante NAXA est accessible, mais elle ne contient pas encore l'ensemble des migrations présentes sur la branche de travail. Elle ne peut donc pas servir de preuve des fonctionnalités nouvelles sans modifier Production.
- **Cause racine commune :** absence d'un environnement reproductible qui rejoue exactement le schéma, toutes les migrations de la branche et tous les tests sur le même HEAD que le code contrôlé.
- **Impact :** N4 à N15 ne peuvent pas être déclarés techniquement/fonctionnellement verts par simple présence du code.
- **Correction engagée :** job CircleCI `sql_tests` + replay Supabase local + exécution de `supabase/tests/*.sql`.
- **Durcissement engagé :** le harnais traite désormais les assertions `false` comme échec bloquant.
- **Règle :** aucune migration de la branche ne sera poussée en Production pour fabriquer une preuve.
- **Statut commun : 🔴 À CORRIGER — preuve reproductible au HEAD manquante.

## C-011 — N4 à N15 : matrice de validation en bulk
| Niveau | Périmètre | Preuve commune |
|---|---|---|
| N4 | Tests | replay migrations + tests SQL bloquants |
| N5 | CI / automatisation | job reproductible + résultat |
| N6 | Base de données | schéma/migrations/RLS/RPC |
| N7 | Logique métier | règles métier sur le même replay |
| N8 | Intégrations fonctionnelles | contrats et flux existants |
| N9 | Architecture / sécurité | RLS, scopes, privilèges, contrôles négatifs |
| N10 | Auth / sessions | identité, sessions, limites |
| N11 | UI / UX | artefact build + recette |
| N12 | Services externes | contrats/configuration sans service payant |
| N13 | Déploiement | artefact validé avant Production |
| N14 | Robustesse / performance | régression + charge raisonnable |
| N15 | Conformité NAXA | cahier v3.7 + preuves cumulées |

**Objectif bulk :** réduire N4–N15 à **un seul problème commun**, puis traiter les anomalies spécifiques seulement si l'exécution en révèle.

**Statut global N4–N15 : 🔴 UN SEUL PROBLÈME COMMUN — preuve d'exécution reproductible au HEAD de la branche.**

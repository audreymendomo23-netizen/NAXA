# Validation simultanée du compte Comptable — plan initial (étapes 0 à 6)

Date : 21 octobre 2026  
Branche de référence : `main`  
Cahier normatif : `docs/CAHIER_DES_CHARGES_COMPTE_COMPTABLE.md`  
Périmètre : validation fonctionnelle et technique du parcours Comptable, hors CI et hors déploiement.  
Base utilisée pour les contrôles SQL : projet Supabase isolé `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`). La base active `eouwtuusnsuxaejsxknf` n'est pas touchée.

## Verdict global

**PARCOURS PARTIEL — certification E2E non acquise.**

Les artefacts applicatifs et migrations sont présents sur `main`. Lors de la reprise du 21 octobre, les tests SQL 160, 163, 164, 165, 166 et 167 à 171 ont renvoyé un marqueur PASS explicite sur la base isolée. Les tests 161 et 162 ont été exécutés sans erreur SQL remontée, mais sans marqueur PASS explicite. Ces résultats prouvent certains garde-fous structurels et un chemin positif du worker, pas le parcours authentifié complet. La base isolée reste non canonique pour un rejeu intégral et ne contient pas les profils ni les données métier nécessaires à la recette E2E.

Aucun contrôle CI n'a été lancé ou consulté. Aucun déploiement n'a été effectué. Aucun changement n'a été appliqué à la base active. Aucun résultat non exécuté n'est déclaré PASS.

## Matrice des étapes initiales

| Étape initiale | État constaté | Preuves | Reste à faire / critère de sortie |
|---|---|---|---|
| 0 — Audit initial sans modification | PARTIEL / À actualiser | `docs/compta/RAPPORT_AUDIT.md`, cahier normatif unique | L'audit initial précède plusieurs ajouts et contient des constats devenus obsolètes (ex. moteur absent). Réconcilier chaque exigence du cahier avec le code actuel, les API/RPC, RLS, migrations et tests. |
| 1 — Base de données | PARTIELLEMENT VALIDÉ | `RAPPORT_ETAPE_1.md`; tests SQL 160, 164–171 (sauf 161–162 non certifiés) exécutés sur base isolée | Réconcilier l'historique de migrations avec `main` et obtenir un rejeu propre; tester les droits par sessions authentifiées et par pharmacie. L'historique isolé présente des doublons de noms et ne comporte pas l'entrée attendue pour `migration_20261023_compta_rapports_planifies.sql`; ne pas appliquer aveuglément des migrations anciennes.
| 2 — Moteur de calcul | CODE PRÉSENT, EXÉCUTION NON CONFIRMÉE | `src/lib/compta/{types,calculs,moteur,index}.ts`; `scripts/test-compta-moteur.cjs`; script `test:compta-moteur` dans `package.json` | Exécuter le script unitaire hors CI, corriger les échecs et prouver les cas limites, puis typecheck local hors CI. Jusqu'à cette exécution, tests = NON EXÉCUTÉS. |
| 3 — Alimentation automatique | PARTIELLEMENT VALIDÉE | `RAPPORT_ETAPE_3.md`, `RAPPORT_ETAPE_4.md`; tests 160–163 exécutés, 160 et 163 PASS explicites; 161–162 sans marqueur final | Le chemin positif transactionnel du worker est vérifié; restent à certifier les tests 161–162, l'appel depuis les événements métier réels, les reprises/doublons/erreurs et les flux métier non démontrés.
| 4 — Interface utilisateur | PARTIELLE | Routes présentes : tableau de bord, journal ventes, rapprochements, créances/bordereaux, clôtures, documents, audit, rapports/exports, profil et référentiels | Inspecter chaque route et API; prouver les états vide/erreur/interdit, les filtres, la navigation, l'accessibilité, les permissions et l'absence de données de santé. Les tests navigateur n'ont pas été exécutés. |
| 5 — Clôtures, exports et audit | PARTIELLEMENT VALIDÉ | `RAPPORT_ETAPE_8.md`, `RAPPORT_ETAPE_9.md`, `RAPPORT_ETAPE_10.md`; SQL 167–171 PASS rapportés; CSV/XLSX/PDF et SHA-256 dans le code | Exécuter les parcours réels d'ouverture/clôture et télécharger/inspecter les exports. Bilan, résultat, TVA et paie restent correctement bloqués (HTTP 409) tant que sources/mappings ne sont pas confirmés. Tester une chaîne d'audit avec écritures réelles et une contre-passation. |
| 6 — Recette et acceptation | BLOQUÉE / NON TERMINÉE | Rapport étape 9 et 10 : profils = 0, ventes = 0, écritures = 0 dans la base isolée | Préparer un jeu de test transactionnel et des identités de test contrôlées, puis exécuter les scénarios positifs et négatifs du cahier, avec preuves par scénario. Aucun E2E authentifié n'est confirmé. |

## Contrôles de base isolée exécutés pendant cette validation

Requête SQL en lecture seule sur `naxa-ci-replay-2` :

| Table | Nombre observé |
|---|---:|
| `pharmacies` | 6 |
| `profiles` | 0 |
| `ventes` | 0 |
| `depenses` | 0 |
| `tresorerie_mouvements` | 0 |
| `compta_periodes` | 0 |
| `compta_ecriture` | 0 |
| `compta_ligne` | 0 |
| `compta_plan_comptable` | 0 |

**Conséquence :** aucune recette authentifiée avec données métier ne peut être prouvée dans l'état actuel de cette base. Ces zéros ne sont pas une preuve que l'application ne fonctionne pas; ils établissent l'absence de fixtures nécessaires à l'E2E.

## Alertes Supabase observées sur la base isolée

Ces alertes sont relevées pour suivi séparé; aucune correction globale n'est appliquée sans analyse d'impact.

- **ERROR —** vue `public.v_reservations_ca` déclarée SECURITY DEFINER. Examiner le comportement RLS et les consommateurs avant de la modifier. [Documentation Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view)
- **INFO —** 13 tables avec RLS activée mais sans politique. Pour les tables internes de sécurité, cela peut être intentionnel (aucun accès direct); vérifier les privilèges et RPC qui y accèdent avant de créer des politiques. [Documentation Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- **WARN —** extensions `pg_trgm` et `unaccent` dans `public`; examiner les dépendances avant déplacement. [Documentation Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)
- **WARN —** 15 fonctions SECURITY DEFINER exécutables par `anon`; analyser fonction par fonction et retirer les droits uniquement lorsque l'accès public n'est pas intentionnel. [Documentation Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- **Performance —** le conseiller a signalé un grand nombre de clés étrangères sans index couvrant. Prioriser les tables/charges critiques et vérifier l'absence d'index équivalents avant toute création.
- Des index dupliqués ont été signalés précédemment pour `abonnements` et `reservation_events`; vérifier leur définition et leurs usages avant suppression.

Ces constats proviennent de l'environnement isolé; ils ne prouvent pas que la base active présente exactement le même état.

## Contradictions à préserver

1. Le Comptable est un poste de consultation, rapprochement et export; `MANAGE_ACCOUNTING` n'autorise pas globalement les encaissements, modifications de ventes, mouvements de stock ou clôtures de caisse.
2. Aucune TVA, paie, immobilisation, dotation ou état SYSCOHADA ne doit être inventé lorsque sa source et ses règles ne sont pas confirmées.
3. Les données de santé nominatives sont interdites dans les écrans, API, exports et journaux Comptable.
4. Un échec de disponibilité ou d'accès ne doit pas être converti en zéro ni présenté comme une chaîne d'audit invalide.
5. Une table sans politique RLS ne doit pas recevoir automatiquement une politique permissive : vérifier l'intention d'accès et les RPC serveur.

## Plan d'exécution simultanée hors CI

1. **Audit statique** : couvrir le cahier, les pages, API, worker, fonctions SQL, migrations, RLS et tests; marquer chaque critère conforme, partiel, bloqué ou absent.
2. **Validation moteur** : exécuter `npm run test:compta-moteur` localement hors CI, puis corriger et retester les échecs.
3. **Validation SQL isolée** : réconcilier l'historique des migrations sans réappliquer aveuglément des versions; exécuter les tests SQL dans un environnement de test canonique.
4. **Validation E2E** : créer des fixtures exclusivement temporaires/transactionnelles ou des identités de test autorisées; couvrir vente, dépense, trésorerie, créance/bordereau, clôture, audit et exports.
5. **Validation sécurité** : essais négatifs inter-pharmacies, privilèges atomiques, RPC directes et absence de données de santé dans les exports.
6. **Validation UI** : parcourir chaque route avec sessions autorisées et non autorisées; vérifier les erreurs, téléchargements et formats.
7. **Compte rendu final** : joindre les preuves exactes; garder `NON EXÉCUTÉ` ou `BLOQUÉ` tant qu'une étape ne peut pas être exécutée.

## Prochaine étape

Le premier blocage pratique est l'absence d'un environnement de test canonique avec profils et données métier. Avant d'injecter des fixtures ou de corriger l'historique, inventorier les migrations du dépôt et les dépendances réelles de la base isolée. Ne pas créer de branche ou de projet Supabase payant sans accord explicite. Ne pas toucher à la base active. Aucun CI, déploiement ou pipeline ne fait partie de cette validation.


## Mise à jour de la reprise — 21 octobre 2026

- Correction moteur sur `main` : `03b583e03d96ec5c800283438a6c36857c23cce5` — validation stricte des dates calendaires dans `resoudreMappingEvenement`.
- Tests de régression ajoutés : `9d913120a14178bf5cd8b55f16b58151b0ec2818` — dates d'événement et de mapping impossibles, intervalle de mapping inversé.
- Documentation de résultats actualisée : `fcb5f023afb93c84b355364b80453863be852aff`.
- Les tests SQL 164, 165 et 166 ont été retrouvés dans le dépôt et exécutés sur la base isolée : tous trois ont retourné un marqueur PASS explicite. Ils couvrent RLS des rapports, référentiels en lecture seule et RPC des reçus d'abonnement.
- Le contrôle JavaScript ciblé de validation de date a passé 6/6 cas attendus. Le script `npm run test:compta-moteur` n'a toujours pas été exécuté dans un checkout local; les tests ajoutés ne sont donc pas déclarés verts tant que ce script n'est pas réellement lancé.
- Le rejeu canonique des migrations, le typecheck, le lint, le build, les tests navigateur et la recette E2E authentifiée restent non exécutés ou bloqués par l'absence d'un checkout local et de profils/données métier dans la base de test.
- La base active Supabase n'a pas été modifiée. Aucun contrôle CI ni déploiement n'a été effectué.

## Prochaine étape

Obtenir un checkout local reproductible autorisé pour lancer le moteur TypeScript, typecheck, lint et build hors CI; puis constituer des identités et fixtures strictement isolées pour la recette E2E. Avant toute application de migration, examiner les dépendances de `migration_20261023_compta_rapports_planifies.sql` et les doublons de l'historique de test.

# Kit de construction — famille de 7 applications

Contenu préparé par Claude le 1 novembre 2026. Tout ce qui est marqué « testé » a été exécuté ; le reste est livré en l'état et doit être relu.

## Ce qui est testé (exécuté ici)
- `logic/` : logique de référence en JavaScript (argent, abonnement, SMS, soldes, gaz, cuisine, tontine, locatif, hôtel).
  Lancer les tests : `node --test tests/logic.test.mjs` → 16 tests, 16 réussis.
- `docs/vectors.json` : jeux d'entrées et de sorties exactes que le code Android doit reproduire.
- `web/admin.html` : prototype d'espace admin, testé dans un navigateur sur un écran de téléphone. Regénérer : `node web/build_admin.mjs`.

## Ce qui n'est PAS testé
- `sql/` : migrations PostgreSQL écrites avec soin mais jamais exécutées (aucun PostgreSQL disponible). À relire, tester sur une base vide, puis appliquer seulement avec accord explicite.
- Aucune application Android n'a été compilée.
- Les règles de lecture des SMS sont des exemples fictifs.

## Règles de travail (reprises dans tous les prompts)
Travailler uniquement sur main ; aucune branche parallèle, aucune pull request, aucune vérification CI, aucun déploiement, sans accord explicite et écrit.

## Pour ChatGPT
Coller `docs/PASSATION_kit_de_construction.md` en tête du prompt 0.1, puis suivre le dossier de prompts. Demander à ChatGPT de PORTER cette logique (pas de la réécrire) et de rejouer `docs/vectors.json`.

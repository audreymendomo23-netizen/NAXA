# NAXA — reprise opérationnelle

Date de mise à jour : 2026-10-09

## Règles impératives
- Aucun commit sur `main`, aucune PR vers `main`, aucune fusion sans la phrase exacte « OUI, DÉPLOIE ».
- Production Supabase `eouwtuusnsuxaejsxknf` : lectures seules. Aucun secret dans les rapports.
- Aucune migration existante modifiée ; correctifs SQL additifs seulement.
- Aucun projet Supabase supprimé, mis en pause ou restauré sans nécessité.
- Distinguer preuves d'exécution, contenu lu et points inconnus. Aucun vert sans logs.
- Branche de travail : `ci/replay-rewrite-20261008`.

## État vérifié
- `STATUT.md` et `README.md` lus sur la branche de travail. STATUT comporte des sections historiques contradictoires ; les mentions anciennes de HEAD ne valent pas preuve du HEAD actuel.
- Comparaison de `.circleci/config.yml` : `ae8c068` ne contient pas les antislashs avant les heredocs ; `4680e7d` les contient. Le HEAD de travail avait régressé sur ce point.
- Correction des heredocs poussée sur la branche : commit `16441ef27ef022f3096b8fe2bfde92b84f0c4a26`.
- Le filtre SQL a été modifié dans un commit antérieur de cette branche pour demander la sortie JSON, rejeter les résultats vides et les booléens faux. Il reste à valider avec un vrai run CircleCI et à compléter/valider l'auto-test du filtre.
- GitHub Combined Status du commit de correction retournait une liste vide ; le seul workflow GitHub Actions retourné était un run non pertinent en échec. Cela ne prouve ni déclenchement ni résultat CircleCI.
- Lecture seule Production : requête `pg_class.relrowsecurity` sur les tables `public` a retourné zéro table sans RLS. Aucun défaut de RLS de table n'est donc démontré par cette requête sur la Production. Cela ne vérifie pas les policies ni les privilèges.
- Projet `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`) observé `INACTIVE`. Tentative de restauration refusée par Supabase : « The following organization members have reached their maximum limits for the number of active free projects within organizations where they are an administrator or owner: Projet-Naxa (2 project limit). To continue, these users will need to either delete, pause or upgrade one or more of these projects. » Aucun autre projet touché.
- Projet `naxa-ci-replay` (`fnlyjlvflgiewrkmnisi`) observé `ACTIVE_HEALTHY`. Liste des migrations indisponible sur la tentative : « Connection terminated due to connection timeout ».
- Aucune migration n'a été rejouée et aucun des 52 tests n'a été exécuté sur la base complète dans cette passe. Aucune preuve de validation de 055b/055c.

## Prochaine action
1. Confirmer sur CircleCI que le commit `16441ef27ef022f3096b8fe2bfde92b84f0c4a26` déclenche un pipeline ; relever pipeline, `quality`, `sql_tests` et logs.
2. Vérifier/ajouter l'auto-test du filtre d'assertion SQL avant de considérer le harnais validé.
3. Résoudre le blocage de limite de projets Supabase sans supprimer ni mettre en pause un projet non autorisé ; puis restaurer uniquement `naxa-ci-replay-2`.
4. Reprendre le rejeu manuel sur le projet de test confirmé, après vérification de son identifiant, une migration à la fois ; enregistrer la première erreur SQL exacte et ne pas corriger en cours de rejeu.
5. Auditer 055b/055c sur la base complète ; documenter les défauts RLS historiques avec la migration source et proposer seulement un correctif additif.
6. Mettre à jour ce fichier, `STATUT.md` et `README.md` après chaque preuve réelle.

## Derniers identifiants
- Commit de correction heredocs : https://github.com/audreymendomo23-netizen/NAXA/commit/16441ef27ef022f3096b8fe2bfde92b84f0c4a26
- PR #36 : ne pas fusionner.
- PR #37 : brouillon vers rewrite ; PR #38 : sonde, état actuel à re-vérifier.


## Mise à jour opérationnelle — 2026-10-09
- Preuve d'exécution : pause demandée pour `naxa-ci-replay` (`fnlyjlvflgiewrkmnisi`) retournée avec success=true ; le dernier état lu est encore `PAUSING`, donc la pause n'est pas confirmée comme terminée.
- Preuve d'exécution : restauration de `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`) retournée avec success=true ; le dernier état lu est `COMING_UP`, pas encore `ACTIVE_HEALTHY`.
- Production `eouwtuusnsuxaejsxknf` relue avant/après les actions : `ACTIVE_HEALTHY`; aucune action d'écriture ciblée sur la Production.
- Commit de l'auto-test du filtre : `09084d9cc57f6923fc6d4bb5e59a49122fd2b506`; correction du heredoc ajouté : `ffb0f377c78f47694ca3f98e0c1454f3387aca87`.
- Le filtre a des cas fictifs t, f, zéro ligne, nom de colonne contenant f et erreur SQL. L'exécution CircleCI n'est pas encore prouvée. Le runner actuel n'emploie pas encore explicitement `ON_ERROR_STOP=1` : ne pas déclarer le filtre complet tant que ce point n'est pas corrigé et testé.
- Grep du fichier CircleCI : 4 occurrences `\\<<` pour heredocs Python/EOF/SQL ; aucune occurrence `>>` relevée. Les opérateurs shell `< <(...)` sont des substitutions de processus, pas des heredocs et ne doivent pas être échappés comme `\\<<`.
- Statut GitHub combiné du commit `ffb0f377...` : aucune status check ; workflow runs GitHub Actions retournés : liste vide. Aucun déclenchement CircleCI confirmé ; pas de surveillance de dix minutes effectuée.
- Compare `4680e7d...HEAD` : 51 commits en avance, 0 en retard ; `.circleci/config.yml` modifié (+63/-14 dans le diff comparatif de branche). Le diff contient d'autres changements que les heredocs ; déclenchement non garanti.
- Aucun rejeu des 78 migrations ni des 52 tests : le projet de test n'est pas encore `ACTIVE_HEALTHY`.
